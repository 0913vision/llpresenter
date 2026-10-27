import type {MediaChoice} from '@shared/live';
import type {EditRefusalReason} from '@shared/schema/contentEdit';
import type {FileError} from '@shared/schema/fileFormat';
import {
  mergeMediaDocument,
  type MediaDocument,
  type MediaEditResult,
} from '@shared/schema/mediaEdit';
import {
  MEDIA_LIMITS,
  serializeMediaList,
  type MediaItem,
} from '@shared/schema/mediaList';
import type {Logger} from '../log';
import type {DocumentFiles} from './contentPersistence';
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
import {buildMediaLibrary, type MediaLibrary} from './mediaLibrary';
import {SettingsPersistence} from './settingsPersistence';

export interface MediaStoreOptions {
  readonly document: MediaDocument;
  readonly file: string;
  readonly mediaFolder: string;
  readonly files: DocumentFiles;
  readonly log: Logger;
  readonly delayMs?: number;
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

  apply(edit: MediaListEdit): Promise<MediaEditResult> {
    return this.safely(() => {
      const refusal = this.refusal(
        'baseRevision' in edit ? edit.baseRevision : undefined,
      );
      if (refusal !== null) return Promise.resolve({ok: false, error: refusal});
      const change = editMediaList(this.document.value, edit);
      return change.ok ? this.commit(change.value) : Promise.resolve(change);
    });
  }

  /** Adds completed imports with reserved IDs and optionally selects their destination playlist. */
  add(
    commit: MediaItemsCommit,
    playlist: PlaylistRef | null,
  ): Promise<MediaEditResult> {
    return this.safely(() => {
      if (
        !Number.isSafeInteger(commit.baseRevision) ||
        commit.baseRevision < 1
      ) {
        return Promise.resolve(
          mediaRefusal('invalid', 'Expected a positive list revision'),
        );
      }
      if (commit.items.length > MEDIA_LIMITS.importBatch) {
        return Promise.resolve(
          mediaRefusal('invalid', 'Too many media items in one commit'),
        );
      }
      const refusal = this.refusal(commit.baseRevision);
      if (refusal !== null) return Promise.resolve({ok: false, error: refusal});
      const current = this.document.value;
      if (!audioReferencesFit(current, commit.items)) {
        return Promise.resolve(
          mediaRefusal('invalid', 'Audio playlists accept only audio'),
        );
      }
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
      if (
        !Number.isSafeInteger(commit.baseRevision) ||
        commit.baseRevision < 1
      ) {
        return Promise.resolve(
          mediaRefusal('invalid', 'Expected a positive list revision'),
        );
      }
      if (commit.items.length > MEDIA_LIMITS.importBatch) {
        return Promise.resolve(
          mediaRefusal('invalid', 'Too many media items in one commit'),
        );
      }
      const refusal = this.refusal(commit.baseRevision);
      if (refusal !== null) return Promise.resolve({ok: false, error: refusal});
      const replacements = new Map(commit.items.map(item => [item.id, item]));
      if (!audioReferencesFit(this.document.value, commit.items)) {
        return Promise.resolve(
          mediaRefusal('invalid', 'Audio playlists accept only audio'),
        );
      }
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
    this.closing ??= this.flush().finally(() => this.saves.dispose());
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

  private buildLibrary(document: MediaDocument) {
    return buildMediaLibrary({
      items: document.value.items,
      mediaFolder: this.options.mediaFolder,
      listFile: this.options.file,
    });
  }

  private commit(change: MediaChange): Promise<MediaEditResult> {
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
