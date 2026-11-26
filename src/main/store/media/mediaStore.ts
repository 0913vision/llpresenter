import type {BundledPicture} from '../pictures/bundledPicture';
import type {MediaChoice} from '@core/schema/live/live';
import type {EditRefusalReason} from '@core/schema/services/contentEdit';
import type {FileError} from '@core/schema/common/fileFormat';
import type {MediaId} from '@core/schema/common/ids';
import {
  mergeMediaDocument,
  type MediaDocument,
  type MediaEdit,
  type MediaEditResult,
} from '@core/schema/media/mediaEdit';
import {
  MEDIA_LIMITS,
  serializeMediaList,
  type MediaItem,
  type MediaList,
  type RemovedMedia,
} from '@core/schema/media/mediaList';
import {isAbsolute, join} from 'node:path';
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
import type {DeletionHold} from '../files/heldDeletions';
import {buildMediaLibrary, type MediaLibrary} from './mediaLibrary';
import {SettingsPersistence} from '../settings/settingsPersistence';
import {pushUndoStep} from '@core/common/undoHistory';

/**
 * What the media store starts from: the media document, its file, the media
 * folder, the document files, the log, and optionally the save delay.
 */
export interface MediaStoreOptions {
  readonly document: MediaDocument;
  readonly file: string;
  readonly mediaFolder: string;
  readonly files: DocumentFiles;
  readonly log: Logger;
  readonly delayMs?: number;
  readonly pictures?: readonly BundledPicture[] | undefined;
  /** Holds the file of deleted media until the app closes, when it goes to the 휴지통. */
  readonly held?: DeletionHold | undefined;
}

/** Hears the media document after each change. */
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
    return this.safely(() =>
      edit.type === 'media.undoDelete' || edit.type === 'media.redoDelete'
        ? this.replayDeletion(edit.type === 'media.undoDelete')
        : this.applyListEdit(edit),
    );
  }

  /**
   * Brings the latest deletion back (`undo`) or deletes it again, and moves
   * it to the other history.
   */
  private replayDeletion(undo: boolean): Promise<MediaEditResult> {
    const from = undo ? this.deleteUndo : this.deleteRedo;
    const to = undo ? this.deleteRedo : this.deleteUndo;
    const step = from.at(-1);
    const refusal = this.refusal(undefined);
    if (refusal !== null) return Promise.resolve({ok: false, error: refusal});
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
    const result = this.commit(
      step.kind !== 'item'
        ? change.value
        : {
            ...change.value,
            value: undo
              ? withoutRecord(change.value.value, step.item.id)
              : withRecord(change.value.value, step),
          },
      true,
    );
    if (this.document.revision !== revision) {
      from.pop();
      to.push(
        undo
          ? step
          : (captureMediaDeletion(before, deletionEdit(step)) ?? step),
      );
      if (step.kind === 'item') {
        const file = this.deletedFiles.get(step.item.id);
        if (undo && file !== undefined) this.releaseFile(file);
        else if (!undo) this.holdFile(step.item.id);
      }
    }
    return result;
  }

  /**
   * Applies an edit of the list; a deletion keeps its step for 실행 취소 and
   * the deleted item's file until quit.
   */
  private applyListEdit(edit: MediaListEdit): Promise<MediaEditResult> {
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
    const step = deleting ? captureMediaDeletion(before, edit) : undefined;
    const result = this.commit(
      step?.kind === 'item'
        ? {...change.value, value: withRecord(change.value.value, step)}
        : change.value,
      deleting,
    );
    const applied = this.document.revision !== revision;
    if (edit.type === 'media.delete' && file !== null && applied) {
      this.deletedFiles.set(edit.mediaId, file);
      this.holdFile(edit.mediaId);
    }
    if (deleting && applied) {
      if (step) pushUndoStep(this.deleteUndo, step);
      this.deleteRedo = [];
    }
    return result;
  }

  /**
   * Takes items whose file left the media folder out of the list, each kept
   * as a record with its places, so it comes back when its file does (USER
   * Nov 26). Not a step of 실행 취소: nobody chose it.
   */
  retire(mediaIds: readonly MediaId[]): Promise<MediaEditResult> {
    return this.safely(() => {
      const refusal = this.refusal(undefined);
      if (refusal !== null) return Promise.resolve({ok: false, error: refusal});
      let value = this.document.value;
      for (const mediaId of mediaIds) {
        const edit = {type: 'media.delete', mediaId} as const;
        const step = captureMediaDeletion(value, edit);
        const change = editMediaList(value, edit);
        if (step?.kind !== 'item' || !change.ok) continue;
        value = withRecord(change.value.value, step);
      }
      return value === this.document.value
        ? Promise.resolve({ok: true, value: null})
        : this.commit({id: mediaIds[0] ?? '', value}, true);
    });
  }

  /**
   * Brings back the item whose record names this file of the media folder,
   * with its id, name, settings and playlist places; null when no record does.
   */
  revive(file: string): Promise<MediaEditResult> | null {
    const record = this.document.value.removed?.find(
      row => this.recordFile(row) === file,
    );
    if (record === undefined) return null;
    return this.safely(() => {
      const refusal = this.refusal(undefined);
      if (refusal !== null) return Promise.resolve({ok: false, error: refusal});
      const value = withoutRecord(this.document.value, record.item.id);
      const change = undoMediaDeletion(value, {kind: 'item', ...record});
      return change.ok
        ? this.commit(change.value, true)
        : this.commit({id: record.item.id, value}, true);
    });
  }

  /** The absolute file of a removed item's record. */
  private recordFile({item}: RemovedMedia): string {
    return isAbsolute(item.file)
      ? item.file
      : join(this.options.mediaFolder, item.file);
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

  /**
   * Holds the file of deleted media until the app closes. Files outside the
   * media folder are the operator's own, and a file another item still uses
   * stays.
   */
  private holdFile(mediaId: string): void {
    const file = this.deletedFiles.get(mediaId);
    const {held, mediaFolder} = this.options;
    if (held === undefined || file === undefined) return;
    if (!isInside(file, mediaFolder)) return;
    if (this.document.value.items.some(item => this.fileOf(item.id) === file)) {
      return;
    }
    // NOTE(0913vision): The file stays where it is, as a screen may still play
    // it and 실행 취소 must find it there before the item is back in the list.
    held.hold(file, true).catch((error: unknown) => {
      this.options.log.warn('could not hold a deleted media file', error);
    });
  }

  /** Lets the held file of media that came back go, so it stays. */
  private releaseFile(file: string): void {
    this.options.held?.restore(file).catch((error: unknown) => {
      this.options.log.warn('could not take a deleted media file back', error);
    });
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

/**
 * The list with a removed item's record, newest last and within
 * `MEDIA_LIMITS.removed`; an older record of the same item or file goes.
 */
function withRecord(
  value: MediaList,
  {kind: _kind, ...record}: Extract<MediaDeletion, {kind: 'item'}>,
): MediaList {
  const others = (value.removed ?? []).filter(
    row => row.item.id !== record.item.id && row.item.file !== record.item.file,
  );
  return {
    ...value,
    removed: [...others, record].slice(-MEDIA_LIMITS.removed),
  };
}

/** The list without the record of an item that came back. */
function withoutRecord(value: MediaList, mediaId: string): MediaList {
  const removed = value.removed?.filter(row => row.item.id !== mediaId);
  if (removed === undefined || removed.length === value.removed?.length) {
    return value;
  }
  const {removed: _old, ...rest} = value;
  return removed.length === 0 ? rest : {...rest, removed};
}
