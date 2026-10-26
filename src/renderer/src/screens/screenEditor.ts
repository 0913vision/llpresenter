import type {LlpApi} from '@shared/ipc';
import type {SettingsDocument} from '@shared/schema/settingsDocuments';
import {pendingWritesOf} from '@renderer/state/pendingWrites';
import {changeScreen, type ScreenChange} from './screenEdits';

type ScreensDocument = Extract<SettingsDocument, {name: 'screens'}>;

/** Where the editor reports a failed save; the window shows it as a notice. */
export type EditProblemReporter = (reason: string) => void;

/**
 * Saves changes to `screens.json` one at a time. Each save starts from the
 * newest revision it knows, which is the one it saved last or the one the
 * window was last given, so quick changes (typing, then a switch) never
 * conflict with each other. A refused save is reported and dropped; the
 * document the window shows is the one main holds.
 */
export class ScreenEditor {
  private base: ScreensDocument | null = null;
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly api: LlpApi,
    private readonly report: EditProblemReporter,
  ) {}

  /** Tells the editor the newest document the window has. Older ones are ignored. */
  adopt(document: ScreensDocument | null): void {
    if (document === null) return;
    if (this.base === null || document.revision > this.base.revision) {
      this.base = document;
    }
  }

  /** Saves the change to one screen; resolves when it is saved or dropped. */
  change(screenId: string, change: ScreenChange): Promise<void> {
    return pendingWritesOf(this.api)
      .run({
        refused: false,
        sent: applied => applied,
        write: () => {
          const operation = this.queue.then(() => this.save(screenId, change));
          this.queue = operation.then(() => undefined);
          return operation;
        },
      })
      .then(() => undefined);
  }

  private async save(screenId: string, change: ScreenChange): Promise<boolean> {
    const base = this.base;
    if (base?.access !== 'editable') return false;
    const value = {
      ...base.value,
      screens: changeScreen(base.value.screens, screenId, change),
    };
    try {
      const result = await this.api.settings.edit({
        type: 'settings.update',
        name: 'screens',
        value,
        baseRevision: base.revision,
      });
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
      this.report(result.error.message);
      return result.error.reason === 'write-failed';
    } catch (cause) {
      this.api.log.write({
        level: 'error',
        message: 'Could not save the screens',
        detail: cause instanceof Error ? cause.message : String(cause),
      });
      this.report('화면 설정 저장 실패');
      return false;
    }
  }
}
