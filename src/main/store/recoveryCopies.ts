import {copyFile, mkdir, readdir, rm} from 'node:fs/promises';
import {join} from 'node:path';
import type {Result} from '@shared/result';
import {PREFERENCE_LIMITS} from '@shared/schema/preferences';
import type {WriteProblem} from './atomicWrite';
import {isMissingFile} from './fsErrors';

const COPY_EXTENSION = '.json';
const MIN_INTERVAL_MS = 5 * 60 * 1000;
const MIN_COPIES = 1;

/** The file about to be overwritten, and where its copies belong. */
export interface RecoveryTarget {
  readonly file: string;
  /** The kind of file, such as `song` or `service`: the first folder level. */
  readonly kind: string;
  /** The id of the song, service, or settings file: the second folder level. */
  readonly id: string;
}

export interface RecoveryCopiesOptions {
  /** The `.recovery` folder of the data folder. */
  readonly folder: string;
  /** How many copies to keep per file: 환경설정 복구 사본, 10 by default. */
  readonly keep: () => number;
  readonly now?: () => number;
}

/**
 * Keeps the previous version of a file before it is overwritten, as
 * `.recovery/<kind>/<id>/<time>.json`. It keeps at most one copy of the same
 * file every 5 minutes, so typing doesn't make a copy per keystroke, and
 * deletes the oldest copies past the count to keep.
 */
export class RecoveryCopies {
  private readonly lastCopyAt = new Map<string, number>();
  private readonly now: () => number;

  constructor(private readonly options: RecoveryCopiesOptions) {
    this.now = options.now ?? Date.now;
  }

  /** Never throws. A missing file needs no copy. */
  async keepPrevious(
    target: RecoveryTarget,
  ): Promise<Result<void, WriteProblem>> {
    const now = this.now();
    this.forgetOldCopies(now);
    if (this.lastCopyAt.has(target.file)) {
      return {ok: true, value: undefined};
    }
    return this.keepAt(target, now);
  }

  /** Keeps the final content before deletion, even after a recent autosave. */
  keepBeforeDelete(
    target: RecoveryTarget,
  ): Promise<Result<void, WriteProblem>> {
    const now = Math.max(
      this.now(),
      (this.lastCopyAt.get(target.file) ?? -1) + 1,
    );
    return this.keepAt(target, now);
  }

  private async keepAt(
    target: RecoveryTarget,
    now: number,
  ): Promise<Result<void, WriteProblem>> {
    try {
      if (await this.copy(target, now)) {
        this.lastCopyAt.set(target.file, now);
      }
      return {ok: true, value: undefined};
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {ok: false, error: {file: target.file, message}};
    }
  }

  private async copy(target: RecoveryTarget, now: number): Promise<boolean> {
    const folder = join(this.options.folder, target.kind, target.id);
    await mkdir(folder, {recursive: true});
    try {
      await copyFile(target.file, join(folder, copyName(now)));
    } catch (error: unknown) {
      if (isMissingFile(error)) {
        return false;
      }
      throw error;
    }
    await this.deleteOldest(folder);
    return true;
  }

  private async deleteOldest(folder: string): Promise<void> {
    const copies = (await readdir(folder))
      .filter(name => name.endsWith(COPY_EXTENSION))
      .sort();
    const extra = copies.length - copiesToKeep(this.options.keep());
    for (const name of copies.slice(0, Math.max(0, extra))) {
      await rm(join(folder, name), {force: true});
    }
  }

  private forgetOldCopies(now: number): void {
    for (const [file, copiedAt] of this.lastCopyAt) {
      if (now - copiedAt >= MIN_INTERVAL_MS) {
        this.lastCopyAt.delete(file);
      }
    }
  }
}

// NOTE(0913vision): 환경설정 checks its own range; this cap still holds if a
// bad count ever reaches here, so copies never pile up without a limit.
function copiesToKeep(keep: number): number {
  const whole = Number.isFinite(keep) ? Math.floor(keep) : MIN_COPIES;
  return Math.min(
    PREFERENCE_LIMITS.backupCopies.max,
    Math.max(MIN_COPIES, whole),
  );
}

// NOTE(0913vision): A copy's name is its time with the colons replaced, so the
// names are valid on Windows and sort in time order.
function copyName(time: number): string {
  return `${new Date(time).toISOString().replaceAll(':', '-')}${COPY_EXTENSION}`;
}
