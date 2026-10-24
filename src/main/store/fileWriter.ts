import type {Result} from '@shared/result';
import {writeFileAtomically, type WriteProblem} from './atomicWrite';

export type WriteResult = Result<void, WriteProblem>;

/** Writes text to a file and reports how it went. Never throws. */
export type WriteFile = (file: string, text: string) => Promise<WriteResult>;

interface QueuedWrite {
  readonly text: string;
  readonly waiters: ReadonlyArray<(result: WriteResult) => void>;
}

/**
 * Runs the writes to each file one at a time. While a write runs, only the
 * newest text for that file waits: a newer text replaces an older waiting one,
 * and both callers get the result of the newer write. So overlapping writes
 * end with the latest content on disk.
 */
export class FileWriter {
  private readonly running = new Map<string, Promise<void>>();
  private readonly queued = new Map<string, QueuedWrite>();

  constructor(private readonly writeFile: WriteFile = writeFileAtomically) {}

  write(file: string, text: string): Promise<WriteResult> {
    return new Promise(resolve => {
      const waiting = this.queued.get(file)?.waiters ?? [];
      this.queued.set(file, {text, waiters: [...waiting, resolve]});
      if (!this.running.has(file)) {
        this.startNext(file);
      }
    });
  }

  /** Resolves once every write started or waiting so far has finished. */
  async idle(): Promise<void> {
    while (this.running.size > 0) {
      await Promise.all(this.running.values());
    }
  }

  private startNext(file: string): void {
    const next = this.queued.get(file);
    if (next === undefined) {
      this.running.delete(file);
      return;
    }
    this.queued.delete(file);
    const run = this.writeSafely(file, next.text).then(result => {
      next.waiters.forEach(resolve => resolve(result));
      this.startNext(file);
    });
    this.running.set(file, run);
  }

  private async writeSafely(file: string, text: string): Promise<WriteResult> {
    try {
      return await this.writeFile(file, text);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {ok: false, error: {file, message}};
    }
  }
}
