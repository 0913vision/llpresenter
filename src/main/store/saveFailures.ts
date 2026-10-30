import {
  saveFailedProblem,
  type AppProblem,
  type AppProblemOf,
} from '@core/schema/appProblem';
import type {Logger} from '../log';

/** How long waiting files wait before main writes them again by itself. */
export const SAVE_RETRY_INTERVAL_MS = 30_000;

/**
 * How many files in a row may fail again before a retry pass stops, so a full
 * or missing disk costs only a few writes per pass.
 */
export const MAX_FAILED_RETRIES_IN_A_ROW = 3;

/**
 * How many files of a store may wait. At the cap, an edit that would write or
 * delete a file that doesn't wait yet is refused before it changes anything,
 * so nothing waiting is ever dropped.
 */
export const MAX_WAITING_SAVES = 100;

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
  /** Shows the waiting files again, as after an edit was refused at the cap. */
  remind(): void;
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
  private readonly saves = new Map<string, {save: WaitingSave}>();
  private readonly listeners = new Set<SaveProblemListener>();
  private published: AppProblemOf<'save-failed'> | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private retrying: Promise<void> | undefined;
  private disposed = false;

  constructor(private readonly options: SaveFailuresOptions) {}

  /**
   * Keeps a file waiting; a file that waits already keeps its place and
   * retries only its store's newest operation.
   */
  waiting(save: WaitingSave): void {
    if (this.disposed) return;
    // NOTE(0913vision): One entry per file. Each store refuses edits of new
    // files once MAX_WAITING_SAVES of its files wait, so this list holds at
    // most the cap per store, plus files of edits admitted just before it.
    const existing = this.saves.get(save.file);
    if (existing === undefined) this.saves.set(save.file, {save});
    else existing.save = save;
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
    this.remind();
  }

  /** Pushes `save-failed` again while files wait, even if nothing changed. */
  remind(): void {
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
    for (const [file, entry] of [...this.saves]) {
      if (this.disposed || failedInARow >= MAX_FAILED_RETRIES_IN_A_ROW) return;
      if (this.saves.get(file) !== entry) continue;
      await this.retryOne(entry.save);
      if (this.saves.get(file) === entry) {
        failedInARow++;
        this.moveToEnd(file);
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
      : saveFailedProblem(oldest.save.name, this.saves.size);
  }

  private changed(): void {
    this.scheduleRetry();
    this.publishChange();
  }

  private publishChange(): void {
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
          // NOTE(0913vision): A pass moves the files that fail again to the
          // end, which can change the file the card names.
          this.publishChange();
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
