import type {BundledPicture} from '../pictures/bundledPicture';
import type {MediaChoice} from '@core/schema/live';
import type {EditRefusalReason} from '@core/schema/contentEdit';
import type {FileError} from '@core/schema/fileFormat';
import {
  mergeMediaDocument,
  type MediaDocument,
  type MediaEdit,
  type MediaEditResult,
} from '@core/schema/mediaEdit';
import {
  MEDIA_LIMITS,
  MEDIA_DELETE_HISTORY_LIMIT,
  serializeMediaList,
  type MediaItem,
} from '@core/schema/mediaList';
import type {Logger} from '../../base/log';
import type {DocumentFiles} from '../content/contentPersistence';
import {
  audioReferencesFit,
  editMediaList,
  hasPlaylist,
  mediaRefusal,
  playlistItemsValid,
  type MediaChange,
  type MediaListEdit,
  type PlaylistRef,
} from './mediaEdits';
import {
  captureMediaDeletion,
  deletionEdit,
  redoMediaDeletion,
  undoMediaDeletion,
  type MediaDeletion,
} from './mediaDeletionHistory';
import {isInside} from '../locations/locations';
import {buildMediaLibrary, type MediaLibrary} from './mediaLibrary';
import {SettingsPersistence} from '../settings/settingsPersistence';

export interface MediaStoreOptions {
  readonly document: MediaDocument;
  readonly file: string;
  readonly mediaFolder: string;
  readonly files: DocumentFiles;
  readonly log: Logger;
  readonly delayMs?: number;
  readonly pictures?: readonly BundledPicture[] | undefined;
  /** Throws a file away that deleted media had. */
  readonly discard?: ((file: string) => Promise<void>) | undefined;
}

export type MediaListener = (document: MediaDocument) => void;

/** Main-side commits from P6a, validated again before they can enter the list. */
export interface MediaItemsCommit {
  readonly items: readonly MediaItem[];
  readonly baseRevision: number;
}

/** Owns the revisioned list, current file lookup, and atomic debounced saves. */
export class MediaStore implements MediaLibrary {
  readonly startupProblems: readonly FileError[];
  private document: MediaDocument;
  private library: MediaLibrary;
  private readonly listeners = new Set<MediaListener>();
  private readonly saves: SettingsPersistence;
  private closing: Promise<void> | null = null;
  private readonly deleteUndo: MediaDeletion[] = [];
  private deleteRedo: MediaDeletion[] = [];
  /** Where the files of media are that were deleted in this session. */
  private readonly deletedFiles = new Map<string, string>();

  constructor(private readonly options: MediaStoreOptions) {
    this.document = options.document;
    const built = this.buildLibrary(options.document);
    this.library = built.library;
    this.startupProblems = built.problems;
    this.saves = new SettingsPersistence(
      options.files,
      options.log,
      options.delayMs,
    );
  }

  get pictures(): readonly BundledPicture[] {
    return this.options.pictures ?? [];
  }

  get(): MediaDocument {
    return this.document;
  }
  get roots(): readonly string[] {
    return this.library.roots;
  }
  /** The media folder, where imports copy their files. */
  get folder(): string {
    return this.options.mediaFolder;
  }
  fileOf(mediaId: string): string | null {
    return this.library.fileOf(mediaId);
  }
  backgroundOf(mediaId: string): Promise<MediaChoice | null> {
    return this.library.backgroundOf(mediaId);
  }

  subscribe(listener: MediaListener): () => void {
    if (this.closing !== null) return () => undefined;
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  apply(
    edit:
      | MediaListEdit
      | Extract<MediaEdit, {type: 'media.undoDelete' | 'media.redoDelete'}>,
  ): Promise<MediaEditResult> {
    return this.safely(() => {
      if (
        edit.type === 'media.undoDelete' ||
        edit.type === 'media.redoDelete'
      ) {
        const undo = edit.type === 'media.undoDelete';
        const from = undo ? this.deleteUndo : this.deleteRedo;
        const to = undo ? this.deleteRedo : this.deleteUndo;
        const step = from.at(-1);
        const refusal = this.refusal(undefined);
        if (refusal !== null) {
          return Promise.resolve({ok: false, error: refusal});
        }
        if (!step) {
          return Promise.resolve(
            mediaRefusal('not-found', 'No media deletion to undo'),
          );
        }
        const before = this.document.value;
        const change = undo
          ? undoMediaDeletion(before, step)
          : redoMediaDeletion(before, step);
        if (!change.ok) return Promise.resolve(change);
        const revision = this.document.revision;
        const result = this.commit(change.value, true);
        if (this.document.revision !== revision) {
          from.pop();
          to.push(
            undo
              ? step
              : (captureMediaDeletion(before, deletionEdit(step)) ?? step),
          );
        }
        return result;
      }
      const refusal = this.refusal(
        'baseRevision' in edit ? edit.baseRevision : undefined,
      );
      if (refusal !== null) return Promise.resolve({ok: false, error: refusal});
      const change = editMediaList(this.document.value, edit);
      if (!change.ok) return Promise.resolve(change);
      const before = this.document.value;
      const revision = this.document.revision;
      const deleting =
        edit.type === 'media.delete' || edit.type === 'media.playlist.delete';
      const file =
        edit.type === 'media.delete' ? this.fileOf(edit.mediaId) : null;
      const result = this.commit(change.value, deleting);
      if (
        edit.type === 'media.delete' &&
        file !== null &&
        this.document.revision !== revision
      ) {
        this.deletedFiles.set(edit.mediaId, file);
      }
      if (deleting && this.document.revision !== revision) {
        const step = captureMediaDeletion(before, edit);
        if (step) this.deleteUndo.push(step);
        if (this.deleteUndo.length > MEDIA_DELETE_HISTORY_LIMIT) {
          this.deleteUndo.shift();
        }
        this.deleteRedo = [];
      }
      return result;
    });
  }

  /**
   * Why a commit of imported or relinked items can't apply to the list as it
   * is now, or null when it can.
   */
  private commitRefusal(commit: MediaItemsCommit): MediaEditResult | null {
    if (!Number.isSafeInteger(commit.baseRevision) || commit.baseRevision < 1) {
      return mediaRefusal('invalid', 'Expected a positive list revision');
    }
    if (commit.items.length > MEDIA_LIMITS.importBatch) {
      return mediaRefusal('invalid', 'Too many media items in one commit');
    }
    const refusal = this.refusal(commit.baseRevision);
    if (refusal !== null) return {ok: false, error: refusal};
    if (!audioReferencesFit(this.document.value, commit.items)) {
      return mediaRefusal('invalid', 'Audio playlists accept only audio');
    }
    return null;
  }

  /** Adds completed imports with reserved IDs and optionally selects their destination playlist. */
  add(
    commit: MediaItemsCommit,
    playlist: PlaylistRef | null,
  ): Promise<MediaEditResult> {
    return this.safely(() => {
      const refused = this.commitRefusal(commit);
      if (refused !== null) return Promise.resolve(refused);
      const current = this.document.value;
      if (
        commit.items.length === 0 ||
        commit.items.some(item =>
          current.items.some(existing => existing.id === item.id),
        )
      ) {
        return Promise.resolve(
          mediaRefusal('invalid', 'Imports need new, nonempty media IDs'),
        );
      }
      let value = {...current, items: [...current.items, ...commit.items]};
      if (playlist !== null) {
        if (!hasPlaylist(value, playlist)) {
          return Promise.resolve(
            mediaRefusal('not-found', 'This playlist no longer exists'),
          );
        }
        const ids = commit.items.map(item => item.id);
        if (!playlistItemsValid(value, playlist, ids)) {
          return Promise.resolve(
            mediaRefusal('invalid', 'Audio playlists accept only audio'),
          );
        }
        value =
          playlist.kind === 'media'
            ? {
                ...value,
                playlists: value.playlists.map(item =>
                  item.id === playlist.id
                    ? {...item, items: [...item.items, ...ids]}
                    : item,
                ),
              }
            : {
                ...value,
                audioPlaylists: value.audioPlaylists.map(item =>
                  item.id === playlist.id
                    ? {...item, items: [...item.items, ...ids]}
                    : item,
                ),
              };
      }
      return this.commit({id: commit.items[0]?.id ?? '', value});
    });
  }

  /** Replaces analysed items after relinking, against the list revision P6a read. */
  replace(commit: MediaItemsCommit): Promise<MediaEditResult> {
    return this.safely(() => {
      const refused = this.commitRefusal(commit);
      if (refused !== null) return Promise.resolve(refused);
      const replacements = new Map(commit.items.map(item => [item.id, item]));
      if (
        commit.items.length === 0 ||
        replacements.size !== commit.items.length
      ) {
        return Promise.resolve(
          mediaRefusal(
            'invalid',
            'Expected distinct, nonempty replacement media IDs',
          ),
        );
      }
      if (
        commit.items.some(
          item =>
            !this.document.value.items.some(
              existing => existing.id === item.id,
            ),
        )
      ) {
        return Promise.resolve(
          mediaRefusal('not-found', 'This media no longer exists'),
        );
      }
      const value = {
        ...this.document.value,
        items: this.document.value.items.map(
          item => replacements.get(item.id) ?? item,
        ),
      };
      return this.commit({id: commit.items[0]?.id ?? '', value});
    });
  }

  async flush(): Promise<void> {
    await this.saves.flush();
  }

  dispose(): Promise<void> {
    this.listeners.clear();
    this.closing ??= this.flush()
      .then(() => this.discardDeleted())
      .finally(() => this.saves.dispose());
    return this.closing;
  }

  private refusal(
    revision: number | undefined,
  ): {readonly reason: EditRefusalReason; readonly message: string} | null {
    if (this.closing !== null) {
      return {reason: 'not-found', message: 'Media list is unavailable'};
    }
    if (this.document.access === 'readOnly') {
      return {
        reason: 'read-only',
        message: 'A newer app version wrote this file',
      };
    }
    return revision !== undefined && revision !== this.document.revision
      ? {
          reason: 'stale',
          message: `The media list is at revision ${this.document.revision}`,
        }
      : null;
  }

  private safely(
    work: () => Promise<MediaEditResult>,
  ): Promise<MediaEditResult> {
    try {
      return work();
    } catch (error: unknown) {
      this.options.log.error('could not apply a media list edit', error);
      return Promise.resolve(
        mediaRefusal(
          'invalid',
          error instanceof Error ? error.message : String(error),
        ),
      );
    }
  }

  /**
   * Throws away the files of media deleted in this session, once nothing can
   * bring them back. Files outside the media folder are the operator's own.
   */
  private async discardDeleted(): Promise<void> {
    const {discard, mediaFolder, log} = this.options;
    if (discard === undefined) return;
    const used = new Set(
      this.document.value.items.map(item => this.fileOf(item.id)),
    );
    for (const file of new Set(this.deletedFiles.values())) {
      if (used.has(file) || !isInside(file, mediaFolder)) continue;
      await discard(file).catch((error: unknown) =>
        log.warn('could not throw away a deleted media file', error),
      );
    }
  }

  private buildLibrary(document: MediaDocument) {
    return buildMediaLibrary({
      items: document.value.items,
      mediaFolder: this.options.mediaFolder,
      listFile: this.options.file,
      pictures: this.pictures,
    });
  }

  private commit(
    change: MediaChange,
    keepDeleteHistory = false,
  ): Promise<MediaEditResult> {
    const parsed = mergeMediaDocument(this.document, change.value);
    if (!parsed.ok) {
      return Promise.resolve(
        mediaRefusal(
          'invalid',
          `${parsed.error.field}: ${parsed.error.message}`,
        ),
      );
    }
    const next = parsed.value;
    const built = this.buildLibrary(next);
    // NOTE(0913vision): Existing refused paths must not block unrelated list repairs.
    const previousProblems = new Map(
      this.document.value.items
        .filter(item => this.library.fileOf(item.id) === null)
        .map(item => [item.id, item.file]),
    );
    if (
      built.problems.some(problem => {
        const index = Number(problem.field.split('.')[1]);
        const item = next.value.items[index];
        return (
          item === undefined || previousProblems.get(item.id) !== item.file
        );
      })
    ) {
      return Promise.resolve(
        mediaRefusal(
          'invalid',
          'A media file path is outside the allowed folders',
        ),
      );
    }
    const text = serializeMediaList(next.value, this.options.file);
    if (!text.ok) {
      return Promise.resolve(mediaRefusal('invalid', text.error.message));
    }
    if (!keepDeleteHistory) {
      this.deleteRedo = [];
    }
    this.document = next;
    this.library = built.library;
    const written = this.saves.save({
      target: {file: this.options.file, kind: 'settings', id: 'media'},
      text: text.value,
    });
    for (const listener of this.listeners) {
      if (this.closing !== null) break;
      try {
        listener(next);
      } catch (error: unknown) {
        this.options.log.error('media change listener failed', error);
      }
    }
    const applied = {id: change.id, revision: next.revision};
    return written.then(result =>
      result.ok
        ? {ok: true, value: applied}
        : {
            ok: false,
            error: {
              reason: 'write-failed',
              message: result.error.message,
              applied,
              unchangedFiles: [this.options.file],
            },
          },
    );
  }
}
