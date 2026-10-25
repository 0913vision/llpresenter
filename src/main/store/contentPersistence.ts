import type {Logger} from '../log';
import type {WriteResult} from './fileWriter';
import type {RecoveryTarget} from './recoveryCopies';
import type {SaveRequest} from './saver';

/** Saves and deletes the files of documents, with recovery copies. */
export interface DocumentFiles {
  write(request: SaveRequest): Promise<WriteResult>;
  remove(target: RecoveryTarget): Promise<WriteResult>;
}

type Pending =
  | {readonly kind: 'write'; readonly request: SaveRequest}
  | {readonly kind: 'remove'; readonly target: RecoveryTarget};

/** Keeps the newest failed operation per file for the next flush to retry. */
export class ContentPersistence {
  private readonly pending = new Map<string, Pending>();

  constructor(
    private readonly files: DocumentFiles,
    private readonly log: Logger,
  ) {}

  write(request: SaveRequest): Promise<WriteResult> {
    return this.perform({kind: 'write', request});
  }

  remove(target: RecoveryTarget): Promise<WriteResult> {
    return this.perform({kind: 'remove', target});
  }

  /** Retries each pending file once, in the order the operations were asked. */
  async flush(): Promise<void> {
    for (const operation of [...this.pending.values()]) {
      await this.perform(operation);
    }
  }

  private async perform(operation: Pending): Promise<WriteResult> {
    const file =
      operation.kind === 'write'
        ? operation.request.target.file
        : operation.target.file;
    this.pending.set(file, operation);
    const result = await this.tryOperation(operation, file);
    if (result.ok) {
      if (this.pending.get(file) === operation) {
        this.pending.delete(file);
      }
    } else {
      this.log.warn('could not persist a content file', result.error);
    }
    return result;
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
