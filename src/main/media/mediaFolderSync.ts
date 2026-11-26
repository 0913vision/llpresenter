import {realpathSync, watch} from 'node:fs';
import {readdir, readFile, stat} from 'node:fs/promises';
import {join} from 'node:path';
import type {MediaId} from '@core/schema/common/ids';
import type {
  MediaDocument,
  MediaEditResult,
} from '@core/schema/media/mediaEdit';
import type {Logger} from '../base/log';
import {isInside} from '../store/locations/locations';
import {mediaKindOf} from './mediaKinds';

/** How long changes in the folder gather before the list follows them. */
export const FOLDER_SYNC_DELAY_MS = 1_000;

/**
 * How long a file must stay as it is before it joins the list, so a file
 * still being copied or written in is not taken half done.
 */
export const SETTLE_MS = 5_000;

/** How long a file handed to `adopt` is left alone before it is tried again. */
const ADOPT_TIMEOUT_MS = 120_000;

/**
 * How often the folder is looked for again after it went away or could not be
 * read, as when it is deleted and restored from the 휴지통.
 */
export const REFOLLOW_MS = 10_000;

/**
 * How often the folder is checked to still be the one heard. Windows tells a
 * watch nothing when its folder is moved or sent to the 휴지통, so a new folder
 * made at the same place would go unheard.
 */
export const FOLDER_CHECK_MS = 30_000;

/** The folder where imports keep a note of the file each one is writing. */
const IMPORT_NOTES = '.imports';

/** What the folder sync uses of the media store. */
export interface FolderSyncStore {
  get(): MediaDocument;
  /** The fixed media folder. */
  readonly folder: string;
  fileOf(mediaId: string): string | null;
  retire(mediaIds: readonly MediaId[]): Promise<MediaEditResult>;
  revive(mediaId: MediaId): Promise<MediaEditResult> | null;
  removedFiles(): ReadonlyMap<string, MediaId>;
  holdsDeleted(file: string): boolean;
}

/** The arguments of the {@link MediaFolderSync} constructor. */
export interface MediaFolderSyncOptions {
  readonly store: FolderSyncStore;
  /** Puts files that are already in the folder into the list, as importing them does. */
  readonly adopt: (files: readonly string[]) => Promise<void>;
  readonly log: Logger;
  readonly now?: () => number;
  /**
   * Hears changes in the folder, and when it is lost, as when the folder is
   * deleted; `fs.watch` by default.
   */
  readonly watch?: (
    folder: string,
    onChange: () => void,
    onLost: (error: unknown) => void,
  ) => () => void;
  readonly delayMs?: number;
  /** How often a lost folder is looked for; {@link REFOLLOW_MS} by default. */
  readonly refollowMs?: number;
  /** How often the folder is checked; {@link FOLDER_CHECK_MS} by default. */
  readonly checkMs?: number;
  /**
   * Which folder is at the path now, or null when none is; the disk and file
   * number by default.
   */
  readonly identify?: (folder: string) => Promise<string | null>;
}

/**
 * Keeps the 미디어 list to the files of the fixed media folder (USER Nov 26):
 * a file in the folder is in the list, coming back as it was when the list
 * keeps a record of it; an item whose file left the folder leaves the list as
 * a record. It follows the folder at launch and whenever it changes. A folder
 * that can't be read, went away or was replaced by another changes nothing,
 * and is looked for again every {@link REFOLLOW_MS} until it is back.
 */
export class MediaFolderSync {
  private running: Promise<void> = Promise.resolve();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private refollowTimer: ReturnType<typeof setTimeout> | undefined;
  private checkTimer: ReturnType<typeof setTimeout> | undefined;
  /** Which folder the watch hears, once known. */
  private heard: string | null = null;
  private stopWatch: (() => void) | undefined;
  private disposed = false;
  /** Whether the folder is lost, so the loss is logged once, not every look. */
  private lost = false;
  /** Files handed to `adopt`, by when, until they are in the list. */
  private readonly adopting = new Map<string, number>();

  constructor(private readonly options: MediaFolderSyncOptions) {}

  /** Follows the folder now and from then on. */
  start(): void {
    this.follow();
    this.schedule(0);
  }

  /** Stops following the folder; a sync under way ends on its own. */
  dispose(): Promise<void> {
    this.disposed = true;
    clearTimeout(this.timer);
    clearTimeout(this.refollowTimer);
    clearTimeout(this.checkTimer);
    this.stopWatch?.();
    return this.running;
  }

  /** Brings the list to the folder once, after any sync under way. */
  sync(): Promise<void> {
    this.running = this.running.then(
      () => this.once(),
      () => this.once(),
    );
    return this.running;
  }

  private schedule(delay: number): void {
    if (this.disposed) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.sync().catch((error: unknown) => {
        this.options.log.warn('could not follow the media folder', error);
      });
    }, delay);
  }

  /** Hears the folder's changes, or looks for it again later. */
  private follow(): void {
    if (this.disposed) return;
    try {
      this.stopWatch = (this.options.watch ?? watchFolder)(
        this.options.store.folder,
        () => this.schedule(this.options.delayMs ?? FOLDER_SYNC_DELAY_MS),
        error => this.lose('lost the media folder', error),
      );
    } catch (error: unknown) {
      this.lose('could not follow the media folder', error);
      return;
    }
    if (this.lost) this.schedule(0);
    this.heard = null;
    this.check();
  }

  /**
   * Remembers which folder the watch hears, then checks now and then that the
   * folder at the path is still that one.
   */
  private check(): void {
    const {store, identify = folderIdentity} = this.options;
    identify(store.folder).then(
      now => {
        if (this.disposed || this.stopWatch === undefined) return;
        if (now === null || (this.heard !== null && now !== this.heard)) {
          this.lose('the media folder went away or was replaced', {now});
          return;
        }
        this.heard = now;
        this.checkTimer = setTimeout(
          () => this.check(),
          this.options.checkMs ?? FOLDER_CHECK_MS,
        );
      },
      (error: unknown) => this.lose('could not check the media folder', error),
    );
  }

  /** Stops hearing a folder that went away and looks for it again later. */
  private lose(message: string, error: unknown): void {
    if (!this.lost) {
      this.lost = true;
      this.options.log.warn(message, {
        folder: this.options.store.folder,
        error,
      });
    }
    this.stopWatch?.();
    this.stopWatch = undefined;
    clearTimeout(this.checkTimer);
    if (this.disposed) return;
    clearTimeout(this.refollowTimer);
    this.refollowTimer = setTimeout(
      () => this.follow(),
      this.options.refollowMs ?? REFOLLOW_MS,
    );
  }

  private async once(): Promise<void> {
    if (this.disposed) return;
    const {store, log} = this.options;
    const folder = store.folder;
    const files = await this.filesOf(folder);
    if ('error' in files) {
      this.lose('could not read the media folder', files.error);
      return;
    }
    if (this.lost) {
      this.lost = false;
      log.info('following the media folder again', {folder});
    }
    const present = new Map(files.map(file => [key(file.path), file]));
    const gone = store
      .get()
      .value.items.filter(item => {
        const file = store.fileOf(item.id);
        return (
          file !== null &&
          isInside(file, folder) &&
          !present.has(key(file)) &&
          !store.holdsDeleted(file)
        );
      })
      .map(item => item.id);
    if (gone.length > 0) await logged(store.retire(gone), log);
    const listed = new Set(
      store
        .get()
        .value.items.map(item => store.fileOf(item.id))
        .flatMap(file => (file === null ? [] : [key(file)])),
    );
    // NOTE(0913vision): Records are kept oldest first, each with its place in
    // the list as it was when it left. Bringing them back newest first undoes
    // the removals in reverse, so items that left together come back in their
    // order.
    const records = new Map(
      [...store.removedFiles()].map(([file, id], order) => [
        key(file),
        {id, order},
      ]),
    );
    const now = (this.options.now ?? Date.now)();
    for (const [file, since] of this.adopting) {
      if (listed.has(file) || now - since > ADOPT_TIMEOUT_MS) {
        this.adopting.delete(file);
      }
    }
    const adopt: string[] = [];
    const revive: Array<{id: MediaId; order: number}> = [];
    let waiting = false;
    for (const file of files) {
      if (
        listed.has(key(file.path)) ||
        this.adopting.has(key(file.path)) ||
        store.holdsDeleted(file.path)
      ) {
        continue;
      }
      if (now - file.changed < SETTLE_MS) {
        waiting = true;
        continue;
      }
      const record = records.get(key(file.path));
      if (record === undefined) adopt.push(file.path);
      else revive.push(record);
    }
    revive.sort((a, b) => b.order - a.order);
    for (const {id} of revive) {
      const revived = store.revive(id);
      if (revived !== null) await logged(revived, log);
    }
    for (const file of adopt) this.adopting.set(key(file), now);
    if (adopt.length > 0) await this.options.adopt(adopt);
    if (waiting) this.schedule(SETTLE_MS);
  }

  /**
   * The media files in the folder and when each last changed, without the
   * hidden ones and the files an import is writing, or why the folder can't
   * be read.
   */
  private async filesOf(
    folder: string,
  ): Promise<
    ReadonlyArray<{path: string; changed: number}> | {error: unknown}
  > {
    let entries;
    try {
      entries = await readdir(folder, {withFileTypes: true});
    } catch (error: unknown) {
      return {error};
    }
    const writing = await importsWriting(folder);
    const files = await Promise.all(
      entries
        .filter(
          entry =>
            entry.isFile() &&
            !entry.name.startsWith('.') &&
            mediaKindOf(entry.name) !== null &&
            !writing.has(key(entry.name)),
        )
        .map(async entry => {
          const path = join(folder, entry.name);
          try {
            const found = await stat(path);
            return [
              {
                path,
                changed: Math.max(
                  found.birthtimeMs,
                  found.ctimeMs,
                  found.mtimeMs,
                ),
              },
            ];
          } catch {
            return [];
          }
        }),
    );
    return files.flat();
  }
}

/** The names of the files the imports under way are writing. */
async function importsWriting(folder: string): Promise<ReadonlySet<string>> {
  let names: string[];
  try {
    names = await readdir(join(folder, IMPORT_NOTES));
  } catch {
    return new Set();
  }
  const files = await Promise.all(
    names.map(async name => {
      try {
        const note: unknown = JSON.parse(
          await readFile(join(folder, IMPORT_NOTES, name), 'utf8'),
        );
        const file =
          typeof note === 'object' && note !== null && 'file' in note
            ? note.file
            : undefined;
        return typeof file === 'string' ? [key(file)] : [];
      } catch {
        return [];
      }
    }),
  );
  return new Set(files.flat());
}

/** A path as Windows compares it: case does not count. */
function key(path: string): string {
  return path.toLowerCase();
}

async function logged(
  result: Promise<MediaEditResult>,
  log: Logger,
): Promise<void> {
  const done = await result;
  if (!done.ok && done.error.reason !== 'write-failed') {
    log.warn('could not bring the media list to the media folder', done.error);
  }
}

/** The disk and file number of a folder, or null when there is none. */
async function folderIdentity(folder: string): Promise<string | null> {
  try {
    const found = await stat(folder, {bigint: true});
    return found.isDirectory() ? `${found.dev}:${found.ino}` : null;
  } catch {
    return null;
  }
}

// NOTE(0913vision): Windows' watcher asserts and ends the process when the
// folder is named by its short 8.3 form (C:\Users\RUNNER~1\...), so it
// watches the folder's full name.
function watchFolder(
  folder: string,
  onChange: () => void,
  onLost: (error: unknown) => void,
): () => void {
  const watcher = watch(realpathSync.native(folder), {persistent: false}, () =>
    onChange(),
  );
  watcher.on('error', (error: unknown) => {
    watcher.close();
    onLost(error);
  });
  return () => watcher.close();
}
