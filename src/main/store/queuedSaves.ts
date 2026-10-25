import type {Logger} from '../log';
import type {Autosave} from './autosave';
import type {WriteResult} from './fileWriter';

interface PendingSave {
  readonly work: () => Promise<WriteResult>;
  readonly result: Promise<WriteResult>;
  readonly finish: (result: WriteResult) => void;
}

function pendingSave(work: PendingSave['work']): PendingSave {
  let finish: PendingSave['finish'] = () => undefined;
  const result = new Promise<WriteResult>(resolve => {
    finish = resolve;
  });
  return {work, result, finish};
}

/** Shares one pending save per document while each callback reads the latest in-memory content. */
export class QueuedSaves {
  private readonly pending = new Map<string, PendingSave>();
  constructor(
    private readonly autosave: Autosave,
    private readonly log: Logger,
  ) {}

  schedule(file: string, work: PendingSave['work']): Promise<WriteResult> {
    const previous = this.pending.get(file);
    const next =
      previous === undefined ? pendingSave(work) : {...previous, work};
    this.pending.set(file, next);
    this.autosave.schedule(file, () => this.run(file));
    return next.result;
  }

  /** Transfers a waiting save's callers to an explicit write of this file. */
  take(file: string): (result: WriteResult) => void {
    this.autosave.cancelPending(file);
    const pending = this.pending.get(file);
    this.pending.delete(file);
    return pending?.finish ?? (() => undefined);
  }

  dispose(): void {
    for (const [file, pending] of this.pending) {
      pending.finish({
        ok: false,
        error: {file, message: 'The content store closed before saving'},
      });
    }
    this.pending.clear();
  }

  private async run(file: string): Promise<void> {
    const pending = this.pending.get(file);
    if (pending === undefined) return;
    this.pending.delete(file);
    try {
      pending.finish(await pending.work());
    } catch (error: unknown) {
      this.log.error('could not save a queued document', {file, error});
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
