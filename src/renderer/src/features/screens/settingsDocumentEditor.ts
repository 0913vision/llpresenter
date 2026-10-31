import type {LlpApi} from '@contracts/ipc/api';
import type {
  SettingsDocument,
  SettingsEdit,
} from '@core/schema/settingsDocuments';
import {pendingWritesOf} from '@renderer/platform/pendingWrites';

export interface SettingsDocumentEditorOptions<T extends SettingsDocument> {
  readonly update: (
    base: T,
    value: T['value'],
  ) => Extract<SettingsEdit, {type: 'settings.update'; name: T['name']}>;
  readonly report: (reason: string) => void;
  readonly failureTitle: string;
  readonly logMessage: string;
}

/** Serializes settings changes, including queued operations in the close flush. */
export class SettingsDocumentEditor<T extends SettingsDocument> {
  private base: T | null = null;
  private queue: Promise<void> = Promise.resolve();
  private unsavedRevision: number | null = null;

  constructor(
    private readonly api: LlpApi,
    private readonly options: SettingsDocumentEditorOptions<T>,
  ) {}

  adopt(document: T | null): void {
    if (
      document !== null &&
      (this.base === null || document.revision > this.base.revision)
    ) {
      this.base = document;
    }
  }

  getSnapshot(): T | null {
    return this.base;
  }

  /** Undefined rejects a domain change; unchanged values need no write. */
  change(
    transform: (value: T['value']) => T['value'] | undefined,
    completion: 'applied' | 'saved' = 'applied',
  ): Promise<boolean> {
    return pendingWritesOf(this.api).run({
      refused: false,
      sent: applied => applied,
      write: () => {
        const result = this.queue.then(() => this.save(transform, completion));
        this.queue = result.then(
          () => undefined,
          () => undefined,
        );
        return result;
      },
    });
  }

  private async save(
    transform: (value: T['value']) => T['value'] | undefined,
    completion: 'applied' | 'saved',
  ): Promise<boolean> {
    const base = this.base;
    if (base?.access !== 'editable') return false;
    try {
      const value = transform(base.value);
      if (value === undefined) return false;
      if (
        value === base.value &&
        (completion === 'applied' || this.unsavedRevision === null)
      ) {
        return true;
      }
      this.unsavedRevision = Math.max(this.unsavedRevision ?? 0, base.revision);
      const result = await this.api.settings.edit(
        this.options.update(base, value),
      );
      if (result.ok) {
        const revision = result.value.revision ?? base.revision;
        this.adopt({
          ...base,
          value,
          revision,
        });
        if (revision >= this.unsavedRevision) {
          this.unsavedRevision = null;
        }
        return true;
      }
      if (result.error.reason === 'write-failed') {
        const revision = result.error.applied.revision ?? base.revision;
        this.unsavedRevision = Math.max(this.unsavedRevision, revision);
        this.adopt({
          ...base,
          value,
          revision,
        });
      }
      this.options.report(result.error.message);
      return result.error.reason === 'write-failed' && completion === 'applied';
    } catch (cause) {
      this.api.log.write({
        level: 'error',
        message: this.options.logMessage,
        detail: cause instanceof Error ? cause.message : String(cause),
      });
      this.options.report(this.options.failureTitle);
      return false;
    }
  }
}
