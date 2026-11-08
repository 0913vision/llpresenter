import {closeStepAfter} from '@core/app/closePolicy';
import type {LlpApi, Unsubscribe} from '@contracts/ipc/api';
import {APP_FLUSH_LIMITS, type AppFlushRequest} from '@core/schema/appFlush';
import type {DraftOutcome} from '@renderer/platform/pendingWrites';

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
  /**
   * Asks what to do with edits that only the operator can settle, such as a
   * 테마 draft, before the flush; undefined when there is nothing to ask. A
   * cancel keeps the window open without the
   * failure dialog.
   */
  readonly decide?: (() => Promise<DraftOutcome> | undefined) | undefined;
}

/**
 * Answers main's request to flush before the control window closes, and holds
 * what the 저장 중 dialog shows meanwhile. Main closes the window after a
 * successful flush; a refusal keeps it open with 다시 시도 and 강제로 닫기.
 */
export class CloseFlush {
  private view: CloseFlushView = 'hidden';
  private timer: ReturnType<typeof setTimeout> | undefined;
  private progress: ReturnType<typeof setInterval> | undefined;
  private disposed = false;
  private generation = 0;
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

  /** Clears a previous close's dialog when its retained window opens again. */
  resume(): void {
    this.generation++;
    clearTimeout(this.timer);
    clearInterval(this.progress);
    this.show('hidden');
  }

  dispose(): void {
    this.disposed = true;
    clearTimeout(this.timer);
    clearInterval(this.progress);
    this.stopAnswering();
    this.listeners.clear();
  }

  private async answer({requestId}: AppFlushRequest): Promise<void> {
    const generation = ++this.generation;
    clearInterval(this.progress);
    this.options.api.app.flushProgress({requestId});
    this.progress = setInterval(() => {
      this.options.api.app.flushProgress({requestId});
    }, APP_FLUSH_LIMITS.progressIntervalMs);
    const question = this.options.decide?.();
    const decision =
      question === undefined ? 'settled' : await this.decided(question);
    if (!this.isCurrent(generation)) return;
    if (decision !== 'settled') {
      clearInterval(this.progress);
      this.options.api.app.flushDone({requestId, result: false});
      this.show(decision === 'canceled' ? 'hidden' : 'failed');
      return;
    }
    this.showSavingSoon();
    const result = await this.flushed();
    if (!this.isCurrent(generation)) return;
    clearInterval(this.progress);
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

  private isCurrent(generation: number): boolean {
    return !this.disposed && generation === this.generation;
  }

  private async decided(
    question: Promise<DraftOutcome>,
  ): Promise<DraftOutcome> {
    try {
      return await question;
    } catch (error) {
      this.logError('could not settle the drafts before closing', error);
      return 'failed';
    }
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
