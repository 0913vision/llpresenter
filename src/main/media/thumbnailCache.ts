import {readdir, rm, stat} from 'node:fs/promises';
import {join} from 'node:path';
import {parseMediaId, type MediaId} from '@shared/schema/ids';
import type {Logger} from '../log';
import {writeFileAtomically} from '../store/atomicWrite';

/** How many thumbnails the cache keeps; the least recently used go first. */
export const MAX_CACHED_THUMBNAILS = 2_000;

const EXTENSION = '.jpg';

/** The arguments of the {@link ThumbnailCache} constructor. */
export interface ThumbnailCacheOptions {
  /** `cache\thumbnails` in the app data folder (spec 02, "Media"). */
  readonly folder: string;
  readonly log: Logger;
  /** {@link MAX_CACHED_THUMBNAILS} by default. */
  readonly maxEntries?: number;
}

function mediaIdOf(fileName: string): MediaId | null {
  if (!fileName.endsWith(EXTENSION)) return null;
  const id = parseMediaId(fileName.slice(0, -EXTENSION.length));
  return id.ok ? id.value : null;
}

/**
 * The media thumbnails in `cache\`, one JPEG per media id, which can be
 * deleted and made again (spec 02, "Media"). It keeps at most
 * {@link MAX_CACHED_THUMBNAILS} and removes the least recently used past
 * that. Never throws: a file it can't read, write, or remove is logged.
 */
export class ThumbnailCache {
  // NOTE(0913vision): A Set keeps the order of use, least recent first.
  private readonly entries = new Set<MediaId>();
  private loaded: Promise<void> | null = null;

  constructor(private readonly options: ThumbnailCacheOptions) {}

  /** The thumbnail's file, or null when there is none. */
  async fileOf(mediaId: MediaId): Promise<string | null> {
    await this.load();
    if (!this.entries.has(mediaId)) return null;
    this.entries.delete(mediaId);
    this.entries.add(mediaId);
    return this.pathOf(mediaId);
  }

  /** Keeps a thumbnail. @returns Its file, or null when it can't be written. */
  async put(mediaId: MediaId, jpeg: Uint8Array): Promise<string | null> {
    await this.load();
    const file = this.pathOf(mediaId);
    const written = await writeFileAtomically(file, jpeg);
    if (!written.ok) {
      this.options.log.warn('could not keep a thumbnail', written.error);
      return null;
    }
    this.entries.delete(mediaId);
    this.entries.add(mediaId);
    await this.trim();
    return file;
  }

  async remove(mediaId: MediaId): Promise<void> {
    await this.load();
    if (!this.entries.delete(mediaId)) return;
    await this.removeFile(mediaId);
  }

  private pathOf(mediaId: MediaId): string {
    return join(this.options.folder, `${mediaId}${EXTENSION}`);
  }

  private load(): Promise<void> {
    this.loaded ??= this.readFolder();
    return this.loaded;
  }

  // NOTE(0913vision): The files' modification times order what was there at
  // launch, so the oldest go first when the cap shrinks.
  private async readFolder(): Promise<void> {
    let names: string[];
    try {
      names = await readdir(this.options.folder);
    } catch (error: unknown) {
      if (!isMissing(error)) {
        this.options.log.warn('could not read the thumbnail cache', error);
      }
      return;
    }
    const found: Array<{readonly id: MediaId; readonly time: number}> = [];
    for (const name of names) {
      const id = mediaIdOf(name);
      if (id === null) continue;
      try {
        found.push({id, time: (await stat(this.pathOf(id))).mtimeMs});
      } catch (error: unknown) {
        this.options.log.warn('could not read a cached thumbnail', error);
      }
    }
    found.sort((a, b) => a.time - b.time);
    for (const {id} of found) this.entries.add(id);
    await this.trim();
  }

  private async trim(): Promise<void> {
    const max = this.options.maxEntries ?? MAX_CACHED_THUMBNAILS;
    while (this.entries.size > max) {
      const [oldest] = this.entries;
      if (oldest === undefined) return;
      this.entries.delete(oldest);
      await this.removeFile(oldest);
    }
  }

  private async removeFile(mediaId: MediaId): Promise<void> {
    try {
      await rm(this.pathOf(mediaId), {force: true});
    } catch (error: unknown) {
      this.options.log.warn('could not remove a cached thumbnail', error);
    }
  }
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
