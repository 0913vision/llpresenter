import type {Result} from '@shared/result';
import type {WriteProblem} from './atomicWrite';

export type WriteResult = Result<void, WriteProblem>;

/** Writes a job, such as a text, to a file and reports how it went. */
export type WriteFile<TJob> = (file: string, job: TJob) => Promise<WriteResult>;

interface QueuedWrite<TJob> {
  readonly job: TJob;
  readonly done: Promise<WriteResult>;
  readonly finish: (result: WriteResult) => void;
}

/**
 * Runs the writes to each file one at a time, in the order they were asked
 * for. While a write runs, only the newest job for that file waits: a newer job
 * replaces an older waiting one, and both callers share the newer write's
 * result. So overlapping writes end with the latest content on disk, and a file
 * never holds more than one waiting job, however often it changes.
 */
export class FileWriter<TJob> {
  private readonly running = new Map<string, Promise<void>>();
  private readonly queued = new Map<string, QueuedWrite<TJob>>();

  constructor(private readonly writeFile: WriteFile<TJob>) {}

  write(file: string, job: TJob): Promise<WriteResult> {
    const waiting = this.queued.get(file);
    if (waiting !== undefined) {
      this.queued.set(file, {...waiting, job});
      return waiting.done;
    }
    const queued = queuedWrite(job);
    this.queued.set(file, queued);
    if (!this.running.has(file)) {
      this.startNext(file);
    }
    return queued.done;
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
    this.running.set(file, this.run(file, next));
  }

  private async run(file: string, write: QueuedWrite<TJob>): Promise<void> {
    write.finish(await this.writeSafely(file, write.job));
    this.startNext(file);
  }

  private async writeSafely(file: string, job: TJob): Promise<WriteResult> {
    try {
      return await this.writeFile(file, job);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {ok: false, error: {file, message}};
    }
  }
}

function queuedWrite<TJob>(job: TJob): QueuedWrite<TJob> {
  let finish: (result: WriteResult) => void = () => undefined;
  const done = new Promise<WriteResult>(resolve => {
    finish = resolve;
  });
  return {job, done, finish};
}
