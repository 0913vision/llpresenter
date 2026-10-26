import {stat} from 'node:fs/promises';
import {basename, dirname, join, relative} from 'node:path';
import type {MediaId} from '@shared/schema/ids';
import type {MediaDocument, MediaEditResult} from '@shared/schema/mediaEdit';
import {MEDIA_LIMITS} from '@shared/schema/mediaList';
import type {Logger} from '../log';
import {mediaRefusal} from '../store/mediaEdits';
import type {MediaItemsCommit} from '../store/mediaStore';
import {fileExists} from './missingFiles';
import type {MediaKind} from './mediaKinds';
import {storedPath} from './storedPath';

/** What relinking uses of the media store. */
export interface RelinkStore {
  get(): MediaDocument;
  readonly folder: string;
  /** The item's absolute file, or null when its path is refused. */
  fileOf(mediaId: string): string | null;
  replace(commit: MediaItemsCommit): Promise<MediaEditResult>;
}

/** The arguments of the {@link MediaRelinker} constructor. */
export interface MediaRelinkerOptions {
  readonly store: () => Promise<RelinkStore | null>;
  /** The relink dialog for one kind; null when it is cancelled or unavailable. */
  readonly chooseFile: (kind: MediaKind) => Promise<string | null>;
  readonly isMissing: (mediaId: MediaId) => boolean;
  /** Checks the relinked files again once the list holds their new paths. */
  readonly recheck: (mediaIds: readonly MediaId[]) => void;
  readonly log: Logger;
  readonly exists?: (file: string) => Promise<boolean>;
}

interface Move {
  readonly id: MediaId;
  readonly file: string;
  readonly size: number;
}

function sameFolder(left: string, right: string): boolean {
  return relative(dirname(left), dirname(right)) === '';
}

// NOTE(0913vision): write-failed means the list applied the change in memory
// and saves it later.
function applied(result: MediaEditResult): boolean {
  return result.ok || result.error.reason === 'write-failed';
}

/**
 * 다시 연결 (spec 08, "Relinking"): the chosen file replaces the path of the
 * media id, so every song and item that uses it works again. Other missing
 * media from the same old folder whose file names exist in the new folder are
 * relinked with it, up to one media list commit.
 */
export class MediaRelinker {
  private relinking = false;

  constructor(private readonly options: MediaRelinkerOptions) {}

  /**
   * Opens the dialog for the item's kind and commits the chosen file. A
   * cancelled dialog, or a signal aborted before the commit, changes nothing.
   * One relink runs at a time.
   */
  async relink(
    mediaId: MediaId,
    signal: AbortSignal,
  ): Promise<MediaEditResult> {
    if (this.relinking) {
      return mediaRefusal('invalid', 'Another relink is already open');
    }
    this.relinking = true;
    try {
      return await this.relinkOne(mediaId, signal);
    } finally {
      this.relinking = false;
    }
  }

  private async relinkOne(
    mediaId: MediaId,
    signal: AbortSignal,
  ): Promise<MediaEditResult> {
    const store = await this.options.store();
    const item = store?.get().value.items.find(entry => entry.id === mediaId);
    if (store === null || item === undefined) {
      return mediaRefusal('not-found', 'This media no longer exists');
    }
    const oldFile = store.fileOf(item.id);
    const chosen = await this.options.chooseFile(item.kind);
    if (chosen === null) return {ok: true, value: null};
    const relinked = await this.moved(store, item.id, chosen);
    if (relinked === null) {
      return mediaRefusal('not-found', 'The chosen file can no longer be read');
    }
    const others =
      oldFile === null
        ? []
        : await this.sameFolderMoves(store, item.id, {oldFile, chosen});
    if (signal.aborted) return {ok: true, value: null};
    // NOTE(0913vision): The dialog and the file checks wait, and the list can
    // change meanwhile, so only the file and size go into the items as they
    // are now, and media deleted meanwhile drop out.
    const {revision, value} = store.get();
    const items = [relinked, ...others].flatMap(({id, file, size}) => {
      const current = value.items.find(entry => entry.id === id);
      return current === undefined ? [] : [{...current, file, size}];
    });
    if (items[0]?.id !== mediaId) {
      return mediaRefusal('not-found', 'This media no longer exists');
    }
    const result = await store.replace({items, baseRevision: revision});
    if (applied(result)) this.options.recheck(items.map(({id}) => id));
    return result;
  }

  private async moved(
    store: RelinkStore,
    id: MediaId,
    file: string,
  ): Promise<Move | null> {
    try {
      const {size} = await stat(file);
      return {id, file: storedPath(store.folder, file), size};
    } catch (error: unknown) {
      this.options.log.warn('could not read a relinked media file', {
        file,
        error,
      });
      return null;
    }
  }

  private async sameFolderMoves(
    store: RelinkStore,
    relinked: MediaId,
    {oldFile, chosen}: {readonly oldFile: string; readonly chosen: string},
  ): Promise<Move[]> {
    const exists = this.options.exists ?? fileExists;
    const moves: Move[] = [];
    for (const item of store.get().value.items) {
      if (moves.length >= MEDIA_LIMITS.importBatch - 1) break;
      const file = store.fileOf(item.id);
      if (
        item.id === relinked ||
        file === null ||
        !this.options.isMissing(item.id) ||
        !sameFolder(file, oldFile)
      ) {
        continue;
      }
      const candidate = join(dirname(chosen), basename(file));
      if (!(await exists(candidate))) continue;
      const moved = await this.moved(store, item.id, candidate);
      if (moved !== null) moves.push(moved);
    }
    return moves;
  }
}
