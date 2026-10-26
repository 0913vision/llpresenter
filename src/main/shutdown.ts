import {flushWithin, type Logger} from './log';

/** How long the save steps may take together before the app quits anyway. */
export const SAVE_LIMIT_MS = 3000;

/** How long quitting then waits for the log to reach the disk. */
export const LOG_FLUSH_LIMIT_MS = 2000;

/** One thing to finish before the app quits, such as writing the UI state. */
export interface ShutdownStep {
  readonly name: string;
  readonly run: () => void | Promise<void>;
}

/** The part of Electron's `app` that quitting needs. */
export interface ShutdownApp {
  on(
    event: 'before-quit',
    listener: (event: {preventDefault(): void}) => void,
  ): unknown;
  quit(): void;
  releaseSingleInstanceLock(): void;
}

/** The arguments of the {@link ShutdownCoordinator} constructor. */
export interface ShutdownOptions {
  readonly app: ShutdownApp;
  readonly log: Logger;
  readonly saveLimitMs?: number;
  readonly logFlushLimitMs?: number;
}

type Phase = 'running' | 'confirming' | 'shuttingDown' | 'done';

function deadline(ms: number): {expired: Promise<'expired'>; cancel(): void} {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<'expired'>(resolve => {
    timer = setTimeout(() => resolve('expired'), ms);
  });
  return {expired, cancel: () => clearTimeout(timer)};
}

/**
 * The one place that decides when the app may quit. Every quit request, from
 * the control window, from Electron, or repeated, waits for the same
 * shutdown: the confirmation check, which may cancel the quit before anything
 * is saved, then the save steps in the order they were added, all within
 * {@link SAVE_LIMIT_MS}, then the log flush within {@link LOG_FLUSH_LIMIT_MS},
 * then the single-instance lock is released and the app really quits. A step
 * that fails or never ends is logged, and the shutdown carries on, so the app
 * always exits.
 */
export class ShutdownCoordinator {
  private readonly steps: ShutdownStep[] = [];
  private phase: Phase = 'running';
  private pendingStep: string | null = null;
  private confirm: () => Promise<boolean> = () => Promise.resolve(true);

  constructor(private readonly options: ShutdownOptions) {
    options.app.on('before-quit', event => this.handleBeforeQuit(event));
  }

  /** Adds a step that runs after the steps added before it. */
  add(step: ShutdownStep): void {
    this.steps.push(step);
  }

  /**
   * Sets the check that runs before any step, such as the control window's
   * flush. It must settle within its own bound. False cancels the quit and
   * the app keeps running; a check that fails counts as true, so the app
   * still quits.
   */
  confirmWith(confirm: () => Promise<boolean>): void {
    this.confirm = confirm;
  }

  private handleBeforeQuit(event: {preventDefault(): void}): void {
    if (this.phase === 'done') return;
    event.preventDefault();
    if (this.phase !== 'running') return;
    this.phase = 'confirming';
    this.confirmThenQuit().catch((error: unknown) => {
      this.options.log.error('shutdown failed; quitting anyway', error);
      this.quitForReal();
    });
  }

  private async confirmThenQuit(): Promise<void> {
    if (!(await this.confirmed())) {
      this.phase = 'running';
      this.options.log.info('quit cancelled before saving');
      return;
    }
    this.phase = 'shuttingDown';
    await this.shutDown();
    this.quitForReal();
  }

  private async confirmed(): Promise<boolean> {
    try {
      return await this.confirm();
    } catch (error) {
      this.options.log.error(
        'could not confirm quitting; quitting anyway',
        error,
      );
      return true;
    }
  }

  private async shutDown(): Promise<void> {
    const {log} = this.options;
    const limit = deadline(this.options.saveLimitMs ?? SAVE_LIMIT_MS);
    const outcome = await Promise.race([this.runSteps(), limit.expired]);
    limit.cancel();
    if (outcome === 'expired') {
      log.error('saving before quitting took too long; quitting anyway', {
        waitingFor: this.pendingStep,
      });
    }
    const flushed = await flushWithin(
      log,
      this.options.logFlushLimitMs ?? LOG_FLUSH_LIMIT_MS,
    );
    if (!flushed) console.error('quitting before the log reached the disk');
  }

  private async runSteps(): Promise<'done'> {
    for (const step of this.steps) {
      this.pendingStep = step.name;
      try {
        await step.run();
      } catch (error) {
        this.options.log.error(`could not ${step.name} before quitting`, error);
      }
    }
    this.pendingStep = null;
    return 'done';
  }

  private quitForReal(): void {
    this.phase = 'done';
    // NOTE(0913vision): Chromium can take seconds to tear down after the quit.
    // Releasing the lock first lets the app open again at once (qa, M1-11).
    this.releaseLock();
    // NOTE(0913vision): Electron ignores a quit made while it is still inside
    // the quit event that was just prevented (qa bug M1-11), so the real quit
    // comes from a later task.
    setImmediate(() => this.options.app.quit());
  }

  private releaseLock(): void {
    try {
      this.options.app.releaseSingleInstanceLock();
    } catch (error) {
      console.error('could not release the single-instance lock', error);
    }
  }
}
