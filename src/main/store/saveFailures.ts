import {
  APP_PROBLEM_LIMITS,
  saveFailedProblem,
  type AppProblem,
  type AppProblemOf,
} from '@shared/schema/appProblem';
import type {Logger} from '../log';

/** How long waiting files wait before main writes them again by itself. */
export const SAVE_RETRY_INTERVAL_MS = 30_000;

/** A file that couldn't be written, and how its store writes it again. */
export interface WaitingSave {
  readonly file: string;
  /** What the 저장할 수 없음 card calls it, such as a song's title. */
  readonly name: string;
  readonly retry: () => Promise<void>;
}

/** Where a store reports the files it couldn't write, and wrote again. */
export interface SaveFailureSink {
  waiting(save: WaitingSave): void;
  saved(file: string): void;
}

export interface SaveFailuresOptions {
  readonly log: Logger;
  readonly retryIntervalMs?: number;
}

export type SaveProblemListener = (problem: AppProblem) => void;

function firstOf<T>(values: Iterable<T>): T | undefined {
  for (const value of values) return value;
  return undefined;
}

/**
 * The files that wait in memory because they couldn't be written, oldest
 * first, at most `APP_PROBLEM_LIMITS.waitingSaves` (spec 02, "Save failures").
 * Every change pushes `save-failed` with the oldest file and the count, and
 * the last file written pushes `save-recovered`. While files wait, they are
 * written again every {@link SAVE_RETRY_INTERVAL_MS}, and at once on
 * {@link SaveFailures.retry}.
 */
export class SaveFailures implements SaveFailureSink {
  private readonly saves = new Map<string, WaitingSave>();
  private readonly listeners = new Set<SaveProblemListener>();
  private published: AppProblemOf<'save-failed'> | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private retrying: Promise<void> | undefined;
  private disposed = false;

  constructor(private readonly options: SaveFailuresOptions) {}

  /** Keeps a file waiting; a file that waits already keeps its place. */
  waiting(save: WaitingSave): void {
    if (this.disposed) return;
    if (
      !this.saves.has(save.file) &&
      this.saves.size >= APP_PROBLEM_LIMITS.waitingSaves
    ) {
      this.options.log.error('too many files wait for a save retry', {
        file: save.file,
      });
      return;
    }
    this.saves.set(save.file, save);
    this.changed();
  }

  saved(file: string): void {
    if (this.saves.delete(file)) this.changed();
  }

  /** Writes every waiting file again once, oldest first, joining a retry that runs. */
  retry(): Promise<void> {
    this.retrying ??= this.retryAll().finally(() => {
      this.retrying = undefined;
    });
    return this.retrying;
  }

  /** The standing problems for `problems.list()`: `save-failed` while files wait. */
  problems(): readonly AppProblem[] {
    const current = this.current();
    return current === null ? [] : [current];
  }

  subscribe(listener: SaveProblemListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  dispose(): void {
    this.disposed = true;
    clearTimeout(this.timer);
    this.timer = undefined;
    this.listeners.clear();
  }

  private async retryAll(): Promise<void> {
    for (const save of [...this.saves.values()]) {
      if (this.disposed) return;
      try {
        await save.retry();
      } catch (error: unknown) {
        this.options.log.error('could not retry a save', {
          file: save.file,
          error,
        });
      }
    }
  }

  private current(): AppProblemOf<'save-failed'> | null {
    const oldest = firstOf(this.saves.values());
    return oldest === undefined
      ? null
      : saveFailedProblem(oldest.name, this.saves.size);
  }

  private changed(): void {
    this.scheduleRetry();
    const current = this.current();
    const previous = this.published;
    if (
      current?.name === previous?.name &&
      current?.count === previous?.count
    ) {
      return;
    }
    this.published = current;
    this.publish(current ?? {kind: 'save-recovered'});
  }

  private scheduleRetry(): void {
    if (this.saves.size === 0) {
      clearTimeout(this.timer);
      this.timer = undefined;
      return;
    }
    if (this.timer !== undefined || this.disposed) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.retry().then(
        () => {
          this.scheduleRetry();
        },
        (error: unknown) => {
          this.options.log.error('could not retry the waiting saves', error);
        },
      );
    }, this.options.retryIntervalMs ?? SAVE_RETRY_INTERVAL_MS);
  }

  private publish(problem: AppProblem): void {
    for (const listener of this.listeners) {
      try {
        listener(problem);
      } catch (error: unknown) {
        this.options.log.error('save problem listener failed', error);
      }
    }
  }
}
