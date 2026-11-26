import {randomUUID} from 'node:crypto';
import {mkdir, readdir, rename, rmdir} from 'node:fs/promises';
import {basename, dirname, join} from 'node:path';
import {fileExists} from '../../base/files/fileExists';
import {isMissingFile} from '../../base/files/fsErrors';
import type {Logger} from '../../base/log';

/**
 * The folder, next to the files of a kind, that holds the deleted ones until
 * the app closes. Listing a folder by extension and backups leave it out.
 */
export const HELD_FOLDER_NAME = '.deleted';

/** What holding deleted files uses: the Windows 휴지통, and the log. */
export interface HeldDeletionsOptions {
  /** Sends a file to the Windows 휴지통. */
  readonly trash: (file: string) => Promise<void>;
  readonly log: Logger;
}

/** What a store needs to hold the file of a deletion and to bring it back. */
export type DeletionHold = Pick<HeldDeletions, 'hold' | 'holds' | 'restore'>;

/**
 * The files of deleted songs, 예배, 템플릿 and media, held until the app
 * closes (USER Nov 26, "모두 닫을 때 휴지통"): a deleted file moves into
 * `.deleted` next to it at once, or stays where it is when the caller asks,
 * comes back on 실행 취소, and goes to the Windows 휴지통 from its own place
 * when the app closes, or at the next launch after a run that didn't close.
 */
export class HeldDeletions {
  /** Each held file by the path it was deleted from; the same path when it couldn't move. */
  private readonly held = new Map<string, string>();

  constructor(private readonly options: HeldDeletionsOptions) {}

  /**
   * Moves a deleted file aside, or keeps it `inPlace` when something may still
   * read it there. A file another program has open stays where it is too; a
   * file that is gone is left alone.
   */
  async hold(file: string, inPlace = false): Promise<void> {
    if (this.held.has(file)) return;
    if (inPlace) {
      this.held.set(file, file);
      return;
    }
    if (!(await fileExists(file))) return;
    const at = join(
      dirname(file),
      HELD_FOLDER_NAME,
      randomUUID(),
      basename(file),
    );
    try {
      await mkdir(dirname(at), {recursive: true});
      await rename(file, at);
      this.held.set(file, at);
    } catch (error: unknown) {
      this.options.log.warn('could not move a deleted file aside', {
        file,
        error,
      });
      this.held.set(file, file);
    }
  }

  /** Whether a deleted file is held for this path. */
  holds(file: string): boolean {
    return this.held.has(file);
  }

  /** Puts a held file back where it was deleted from; nothing when none is held there. */
  async restore(file: string): Promise<void> {
    const at = this.held.get(file);
    if (at === undefined) return;
    this.held.delete(file);
    if (at === file) return;
    await rename(at, file);
    await removeEmpty(dirname(at));
  }

  /** Sends every held file to the 휴지통, as the app closes. */
  async discard(): Promise<void> {
    const held = [...this.held];
    this.held.clear();
    for (const [file, at] of held) await this.send(file, at);
  }

  /**
   * Sends what a run that didn't close left in the `.deleted` folders of
   * `folders` to the 휴지통, as the app starts.
   */
  async sweep(folders: readonly string[]): Promise<void> {
    for (const folder of folders) {
      const holding = join(folder, HELD_FOLDER_NAME);
      for (const entry of await this.entries(holding)) {
        for (const name of await this.entries(join(holding, entry))) {
          await this.send(join(folder, name), join(holding, entry, name));
        }
      }
    }
  }

  /**
   * Trashes a held file from the place it was deleted from when that place is
   * free, so the 휴지통's 복원 puts it back there; otherwise from where it is
   * held. A file the 휴지통 refuses stays held for the next launch.
   */
  private async send(file: string, at: string): Promise<void> {
    if (at === file && !(await fileExists(file))) return;
    const from = at !== file && !(await fileExists(file)) ? file : at;
    try {
      if (from !== at) await rename(at, from);
      await this.options.trash(from);
    } catch (error: unknown) {
      if (from !== at) await rename(from, at).catch(() => undefined);
      this.options.log.warn('could not send a deleted file to the 휴지통', {
        file,
        error,
      });
      return;
    }
    await removeEmpty(dirname(at));
  }

  /** The names in a holding folder; none when there is none. */
  private async entries(folder: string): Promise<readonly string[]> {
    try {
      return await readdir(folder);
    } catch (error: unknown) {
      if (!isMissingFile(error)) {
        this.options.log.warn('could not list deleted files', {folder, error});
      }
      return [];
    }
  }
}

/** Removes a holding folder and `.deleted` above it once they are empty. */
async function removeEmpty(folder: string): Promise<void> {
  if (basename(dirname(folder)) !== HELD_FOLDER_NAME) return;
  for (const empty of [folder, dirname(folder)]) {
    try {
      await rmdir(empty);
    } catch {
      return;
    }
  }
}
