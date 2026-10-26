import {
  saveFailedProblem,
  type AppProblem,
  type AppProblemOf,
} from '@shared/schema/appProblem';
import type {Logger} from '../log';

/** How long waiting files wait before main writes them again by itself. */
export const SAVE_RETRY_INTERVAL_MS = 30_000;

/**
 * How many files in a row may fail again before a retry pass stops, so a full
 * or missing disk costs only a few writes per pass.
 */
export const MAX_FAILED_RETRIES_IN_A_ROW = 3;

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
 * The files that wait in memory because they couldn't be written, in retry
 * order (spec 02, "Save failures"). Every change pushes `save-failed` with
 * the next file and the count, and the last file written pushes
 * `save-recovered`. While files wait, they are written again every
 * {@link SAVE_RETRY_INTERVAL_MS}, which pushes only a change, and at once on
 * {@link SaveFailures.retry}. A pass retries them in order, moves each file
 * that fails again to the end, and stops after
 * {@link MAX_FAILED_RETRIES_IN_A_ROW} failures in a row.
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
    // NOTE(0913vision): One entry per file of a store, which holds every one
    // of those documents in memory already, so this list can't outgrow them.
    this.saves.set(save.file, save);
    this.changed();
  }

  saved(file: string): void {
    if (this.saves.delete(file)) this.changed();
  }

  /**
   * 다시 시도: writes every waiting file again once, oldest first, joining a
   * retry that runs. When files still wait, it pushes `save-failed` again even
   * if nothing changed, because pressing 다시 시도 closed the card.
   */
  async retry(): Promise<void> {
    await this.retryOnce();
    const current = this.current();
    if (current === null || this.disposed) return;
    this.published = current;
    this.publish(current);
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

  private retryOnce(): Promise<void> {
    this.retrying ??= this.retryAll().finally(() => {
      this.retrying = undefined;
    });
    return this.retrying;
  }

  private async retryAll(): Promise<void> {
    let failedInARow = 0;
    for (const save of [...this.saves.values()]) {
      if (this.disposed || failedInARow >= MAX_FAILED_RETRIES_IN_A_ROW) return;
      await this.retryOne(save);
      if (this.saves.has(save.file)) {
        failedInARow++;
        this.moveToEnd(save.file);
      } else {
        failedInARow = 0;
      }
    }
  }

  private async retryOne(save: WaitingSave): Promise<void> {
    try {
      await save.retry();
    } catch (error: unknown) {
      this.options.log.error('could not retry a save', {
        file: save.file,
        error,
      });
    }
  }

  private moveToEnd(file: string): void {
    const save = this.saves.get(file);
    if (save === undefined) return;
    this.saves.delete(file);
    this.saves.set(file, save);
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
      this.retryOnce().then(
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
