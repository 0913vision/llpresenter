import {basename} from 'node:path';
import type {Logger} from '../log';
import type {WriteResult} from './fileWriter';
import type {RecoveryTarget} from './recoveryCopies';
import {MAX_WAITING_SAVES, type SaveFailureSink} from './saveFailures';
import type {SaveRequest} from './saver';

/** Saves and deletes the files of documents, with recovery copies. */
export interface DocumentFiles {
  write(request: SaveRequest): Promise<WriteResult>;
  remove(target: RecoveryTarget): Promise<WriteResult>;
  /** Hears which files couldn't be written, and which were written again. */
  readonly failures?: SaveFailureSink | undefined;
}

type Pending =
  | {readonly kind: 'write'; readonly request: SaveRequest}
  | {readonly kind: 'remove'; readonly target: RecoveryTarget};

/**
 * Keeps the newest failed operation per file for a retry, and reports each
 * such file to the files' failure sink until it is written. A file's later
 * operation replaces its earlier one, so a delete supersedes a write that
 * waits and only the newest intent is retried.
 */
export class ContentPersistence {
  private readonly pending = new Map<string, Pending>();
  /** The files whose newest operation failed. */
  private readonly waiting = new Set<string>();

  /** @param nameOf - What a failure card calls a file; its name by default. */
  constructor(
    private readonly files: DocumentFiles,
    private readonly log: Logger,
    private readonly nameOf: (file: string) => string = file => basename(file),
  ) {}

  write(request: SaveRequest): Promise<WriteResult> {
    return this.perform({kind: 'write', request});
  }

  remove(target: RecoveryTarget): Promise<WriteResult> {
    return this.perform({kind: 'remove', target});
  }

  /**
   * Whether an edit may write or delete these files: each waits already, or
   * fewer than {@link MAX_WAITING_SAVES} files wait.
   */
  admits(files: readonly string[]): boolean {
    return (
      this.waiting.size < MAX_WAITING_SAVES ||
      files.every(file => this.waiting.has(file))
    );
  }

  /** Shows the waiting files again, after an edit was refused at the cap. */
  remind(): void {
    this.files.failures?.remind();
  }

  /** Retries each pending file once, in the order the operations were asked. */
  async flush(): Promise<void> {
    for (const operation of [...this.pending.values()]) {
      await this.perform(operation);
    }
  }

  /** Retries the newest operation of one file, if it still waits. */
  async retry(file: string): Promise<void> {
    const operation = this.pending.get(file);
    if (operation !== undefined) await this.perform(operation);
  }

  private async perform(operation: Pending): Promise<WriteResult> {
    const file =
      operation.kind === 'write'
        ? operation.request.target.file
        : operation.target.file;
    this.pending.set(file, operation);
    const result = await this.tryOperation(operation, file);
    if (!result.ok) {
      this.log.warn('could not persist a content file', result.error);
    }
    if (this.pending.get(file) === operation) this.report(file, result);
    return result;
  }

  private report(file: string, result: WriteResult): void {
    if (result.ok) {
      this.pending.delete(file);
      this.waiting.delete(file);
      this.files.failures?.saved(file);
      return;
    }
    this.waiting.add(file);
    this.files.failures?.waiting({
      file,
      name: this.nameOf(file),
      retry: () => this.retry(file),
    });
  }

  private async tryOperation(
    operation: Pending,
    file: string,
  ): Promise<WriteResult> {
    try {
      return await (operation.kind === 'write'
        ? this.files.write(operation.request)
        : this.files.remove(operation.target));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {ok: false, error: {file, message}};
    }
  }
}
