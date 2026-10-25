import type {Logger} from '../log';
import {Autosave} from './autosave';
import {ContentPersistence, type DocumentFiles} from './contentPersistence';
import type {WriteResult} from './fileWriter';
import type {SaveRequest} from './saver';

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

  save(request: SaveRequest): Promise<WriteResult> {
    const file = request.target.file;
    const pending = this.pending.get(file);
    const latest =
      pending === undefined ? pendingWrite(request) : {...pending, request};
    this.pending.set(file, latest);
    this.autosave.schedule(file, () => this.writePending(file));
    return latest.done;
  }

  async flush(): Promise<void> {
    await this.autosave.flush();
    await this.persistence.flush();
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
