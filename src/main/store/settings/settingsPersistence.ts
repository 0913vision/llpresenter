import type {Logger} from '../../base/log';
import {Autosave} from '../files/autosave';
import {
  ContentPersistence,
  type DocumentFiles,
  type PersistedFile,
} from '../content/contentPersistence';
import type {WriteResult} from '../files/fileWriter';
import type {RecoveryTarget} from '../files/recoveryCopies';
import type {SaveRequest} from '../files/saver';

interface PendingWrite {
  readonly request: SaveRequest;
  readonly done: Promise<WriteResult>;
  readonly finish: (result: WriteResult) => void;
}

function pendingWrite(request: SaveRequest): PendingWrite {
  let finish: (result: WriteResult) => void = () => undefined;
  const done = new Promise<WriteResult>(resolve => {
    finish = resolve;
  });
  return {request, done, finish};
}

/** Debounces one pending write per settings file and shares its final write result. */
export class SettingsPersistence {
  private readonly pending = new Map<string, PendingWrite>();
  private readonly autosave: Autosave;
  private readonly persistence: ContentPersistence;

  constructor(
    files: DocumentFiles,
    private readonly log: Logger,
    delayMs?: number,
  ) {
    this.persistence = new ContentPersistence(files, log);
    this.autosave = new Autosave(
      (file, error) =>
        log.error('could not save app-wide settings', {file, error}),
      delayMs,
    );
  }

  save(request: SaveRequest, immediate = false): Promise<WriteResult> {
    const file = request.target.file;
    const pending = this.pending.get(file);
    const latest =
      pending === undefined ? pendingWrite(request) : {...pending, request};
    this.pending.set(file, latest);
    if (immediate) {
      this.autosave.scheduleNow(file, () => this.writePending(file));
    } else {
      this.autosave.schedule(file, () => this.writePending(file));
    }
    return latest.done;
  }

  /** Deletes a file, and drops a write to it that still waits. */
  remove(target: RecoveryTarget): Promise<WriteResult> {
    const waiting = this.pending.get(target.file);
    this.pending.delete(target.file);
    const removed = this.persistence.remove(target);
    return waiting === undefined
      ? removed
      : removed.then(result => {
          waiting.finish(result);
          return result;
        });
  }

  async flush(): Promise<void> {
    await this.retryPending();
  }

  /** Flushes accepted edits and returns each queued retry's write result. */
  async retryPending(): Promise<readonly PersistedFile[]> {
    await this.savePending();
    return this.persistence.retryPending();
  }

  /** Starts accepted writes immediately and leaves failed writes queued for a later retry. */
  async savePending(): Promise<void> {
    await this.autosave.flush();
  }

  dispose(): void {
    this.autosave.dispose();
  }

  private async writePending(file: string): Promise<void> {
    const pending = this.pending.get(file);
    if (pending === undefined) return;
    this.pending.delete(file);
    try {
      pending.finish(await this.persistence.write(pending.request));
    } catch (error: unknown) {
      this.log.error('could not save app-wide settings', {file, error});
      pending.finish({
        ok: false,
        error: {
          file,
          message: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }
}
