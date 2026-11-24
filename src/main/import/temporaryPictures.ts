import {app} from 'electron';
import {mkdtemp, readFile, rm, stat, unlink} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {
  POWERPOINT_PICTURE_LIMITS,
  type PowerPointPreviewImage,
} from '@core/schema/songs/powerpointImport';
import type {Logger} from '../base/log';
import {powerPointImageSize} from './powerpointImage';

const PNG_FIRST_BYTE = 137;

/** Makes a folder that PowerPoint can write in. */
export function temporaryFolder(): Promise<string> {
  return mkdtemp(join(app.getPath('temp'), 'llp-ppt-'));
}

/** Removes a folder and what is in it, without anybody waiting for it. */
export function removeFolder(folder: string, log: Logger): void {
  rm(folder, {recursive: true, force: true}).catch((error: unknown) =>
    log.warn('could not remove a PowerPoint folder', error),
  );
}

/** The bytes of a picture, unless it is too large to be decoded. */
export async function readBoundedPicture(path: string): Promise<Buffer | null> {
  try {
    const {size} = await stat(path);
    if (size <= 0 || size > POWERPOINT_PICTURE_LIMITS.bytes) return null;
    const bytes = await readFile(path);
    return powerPointImageSize(bytes) === null ? null : bytes;
  } catch {
    return null;
  }
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

/**
 * The pictures that PowerPoint wrote for a window, until it releases them. A
 * window names only a picture that is in here, so it can't read or remove any
 * other file.
 */
export class TemporaryPictures {
  private readonly files = new Set<string>();
  private readonly folders = new Set<string>();
  /** The folders that are still written in. */
  private readonly open = new Set<string>();
  private disposed = false;

  constructor(private readonly log: Logger) {}

  has(path: string): boolean {
    return this.files.has(path);
  }

  add(path: string): void {
    this.files.add(path);
  }

  /** Makes a folder for pictures. */
  async openFolder(): Promise<string> {
    const folder = await temporaryFolder();
    this.folders.add(folder);
    this.open.add(folder);
    return folder;
  }

  /** Nothing more is written in a folder, so it goes with its last picture. */
  async closeFolder(folder: string): Promise<void> {
    this.open.delete(folder);
    await this.removeIfEmpty(folder);
  }

  /** Reads a picture for a window. */
  async read(path: string): Promise<PowerPointPreviewImage> {
    if (this.disposed || !this.has(path)) return null;
    const bytes = await readBoundedPicture(path);
    if (bytes === null || !this.has(path)) return null;
    return {
      mime: bytes[0] === PNG_FIRST_BYTE ? 'image/png' : 'image/jpeg',
      bytes,
    };
  }

  /** Removes a picture that its window needs no more, and tells if it did. */
  async release(path: string): Promise<boolean> {
    if (!this.has(path)) return false;
    try {
      await unlink(path).catch((error: unknown) => {
        if (!isMissing(error)) throw error;
      });
      this.files.delete(path);
      await this.removeIfEmpty(dirname(path));
      return true;
    } catch (error) {
      this.log.warn('could not remove PowerPoint temporary image', error);
      return false;
    }
  }

  dispose(): void {
    this.disposed = true;
    this.files.clear();
    for (const folder of this.folders) removeFolder(folder, this.log);
    this.folders.clear();
  }

  private async removeIfEmpty(folder: string): Promise<void> {
    if (
      !this.folders.has(folder) ||
      this.open.has(folder) ||
      [...this.files].some(file => dirname(file) === folder)
    ) {
      return;
    }
    await rm(folder, {recursive: true, force: true});
    this.folders.delete(folder);
  }
}
