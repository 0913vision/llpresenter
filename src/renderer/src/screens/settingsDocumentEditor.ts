import type {LlpApi} from '@contracts/ipc/api';
import type {
  SettingsDocument,
  SettingsEdit,
} from '@core/schema/settingsDocuments';
import {pendingWritesOf} from '@renderer/state/pendingWrites';

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
  ): Promise<boolean> {
    return pendingWritesOf(this.api).run({
      refused: false,
      sent: applied => applied,
      write: () => {
        const result = this.queue.then(() => this.save(transform));
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
  ): Promise<boolean> {
    const base = this.base;
    if (base?.access !== 'editable') return false;
    try {
      const value = transform(base.value);
      if (value === undefined) return false;
      if (value === base.value) return true;
      const result = await this.api.settings.edit(
        this.options.update(base, value),
      );
      if (result.ok) {
        this.adopt({
          ...base,
          value,
          revision: result.value.revision ?? base.revision,
        });
        return true;
      }
      if (result.error.reason === 'write-failed') {
        this.adopt({
          ...base,
          value,
          revision: result.error.applied.revision ?? base.revision,
        });
      }
      this.options.report(result.error.message);
      return result.error.reason === 'write-failed';
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
