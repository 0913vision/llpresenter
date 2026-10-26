import {closeStepAfter} from '@shared/closePolicy';
import type {LlpApi, Unsubscribe} from '@shared/ipc';
import type {AppFlushRequest} from '@shared/schema/appFlush';

/**
 * How long a close flush may run before the 저장 중 dialog shows, so a normal
 * close never flashes it.
 */
export const SAVING_DIALOG_DELAY_MS = 300;

/** What the 저장 중 dialog shows: nothing, a running flush, or a refusal. */
export type CloseFlushView = 'hidden' | 'saving' | 'failed';

/** The arguments of the {@link CloseFlush} constructor. */
export interface CloseFlushOptions {
  readonly api: Pick<LlpApi, 'app' | 'log' | 'window'>;
  /** Submits pending edits; true when nothing is left unsaved. */
  readonly flush: () => Promise<boolean>;
}

/**
 * Answers main's request to flush before the control window closes, and holds
 * what the 저장 중 dialog shows meanwhile. Main closes the window after a
 * successful flush; a refusal keeps it open with 다시 시도 and 강제로 닫기.
 */
export class CloseFlush {
  private view: CloseFlushView = 'hidden';
  private timer: ReturnType<typeof setTimeout> | undefined;
  private disposed = false;
  private readonly listeners = new Set<() => void>();
  private readonly stopAnswering: Unsubscribe;

  constructor(private readonly options: CloseFlushOptions) {
    this.stopAnswering = options.api.app.subscribeFlushRequests(request => {
      this.answer(request).catch((error: unknown) => {
        this.logError('could not answer the close flush request', error);
      });
    });
  }

  readonly getSnapshot = (): CloseFlushView => this.view;
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** 다시 시도: asks main to close again, which flushes again. */
  readonly retry = (): void => {
    this.show('saving');
    this.options.api.window.control('close');
  };

  /** 강제로 닫기: closes without the flush, dropping what it couldn't save. */
  readonly forceClose = (): void => {
    this.options.api.app.closeAnyway();
  };

  dispose(): void {
    this.disposed = true;
    clearTimeout(this.timer);
    this.stopAnswering();
    this.listeners.clear();
  }

  private async answer({requestId}: AppFlushRequest): Promise<void> {
    this.showSavingSoon();
    const result = await this.flushed();
    clearTimeout(this.timer);
    this.options.api.app.flushDone({requestId, result});
    if (closeStepAfter(result ? 'flushed' : 'refused') === 'warn') {
      this.show('failed');
    }
  }

  private showSavingSoon(): void {
    clearTimeout(this.timer);
    if (this.view !== 'hidden') {
      this.show('saving');
      return;
    }
    this.timer = setTimeout(() => {
      this.show('saving');
    }, SAVING_DIALOG_DELAY_MS);
  }

  private async flushed(): Promise<boolean> {
    try {
      return await this.options.flush();
    } catch (error) {
      this.logError('could not flush the editor before closing', error);
      return false;
    }
  }

  private show(view: CloseFlushView): void {
    if (this.disposed || this.view === view) return;
    this.view = view;
    for (const listener of this.listeners) listener();
  }

  private logError(message: string, error: unknown): void {
    this.options.api.log.write({
      level: 'error',
      message,
      detail: error instanceof Error ? (error.stack ?? error.message) : '',
    });
  }
}
