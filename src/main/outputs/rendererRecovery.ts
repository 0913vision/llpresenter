import type {Logger} from '../log';
import {DRAW_LIMIT_MS, PageLoad, type LoadFailure} from './pageLoad';
import {CRASH_LIMIT, RestartBudget} from './restartBudget';

/**
 * What an output window's renderer shows: the live picture, the empty picture
 * while it reloads after a crash, or the empty picture while the restart limit
 * holds (docs/spec/08-problems.md). The window and its preview both follow it.
 */
export type RendererState = 'running' | 'restarting' | 'limited';

/** Why a renderer process ended, as Electron reports it. */
export interface RendererGoneDetails {
  readonly reason: string;
  readonly exitCode: number;
}

/** How long after a crash the page loads again. Spec 08 aims for 1 second. */
export const RELAUNCH_DELAY_MS = 100;

/**
 * The waits before each attempt while the restart limit holds: 10 s, doubling
 * after each attempt that dies again, up to 60 s (spec 08).
 */
export const COOLDOWN_STEPS_MS: readonly number[] = [
  10_000, 20_000, 40_000, 60_000,
];

/** How long an attempt must run after it draws to end the restart limit. */
export const SURVIVAL_MS = 60_000;

/** The arguments of the {@link RendererRecovery} constructor. */
export interface RecoveryOptions {
  readonly screenId: string;
  /** Loads the page again. Rejects when the page fails to load. */
  readonly reload: () => Promise<void>;
  readonly log: Logger;
  /** Hears every change of {@link RendererRecovery.state}. */
  readonly onStateChange?: (state: RendererState) => void;
}

type Timer = ReturnType<typeof setTimeout>;

type TimerName = 'relaunchTimer' | 'cooldownTimer' | 'survivalTimer';

type LimitPhase = 'none' | 'waiting' | 'attempting';

// NOTE(0913vision): A page that failed to load or draw may still draw late,
// and a page gone with its renderer can only send stale reports. A failure
// counts only while the page is live or loading.
type PageStatus =
  | {readonly kind: 'live'}
  | {readonly kind: 'loading'; readonly load: PageLoad}
  | {readonly kind: 'failed'}
  | {readonly kind: 'gone'};

function cooldownAfter(failedAttempts: number): number {
  const step = Math.min(failedAttempts, COOLDOWN_STEPS_MS.length - 1);
  return COOLDOWN_STEPS_MS[step] ?? SURVIVAL_MS;
}

/**
 * Brings an output window's renderer back after crashes. The first crashes
 * reload the page at once. After {@link CRASH_LIMIT} crashes in a minute, the
 * restart limit holds: the window keeps its empty picture and tries again
 * after a cool-down, one attempt at a time. An attempt that runs a minute after
 * it draws ends the limit. A reload that fails to load or doesn't draw within
 * {@link DRAW_LIMIT_MS} fails like a crash, once; a page that draws late still
 * counts as working. While the output is off, no attempt starts; turning it on
 * starts one at once, and so does 다시 시도 while the output is on.
 */
export class RendererRecovery {
  private current: RendererState = 'running';
  private phase: LimitPhase = 'none';
  private page: PageStatus = {kind: 'live'};
  private failedAttempts = 0;
  private paused = false;
  private readonly budget = new RestartBudget();
  private relaunchTimer: Timer | null = null;
  private cooldownTimer: Timer | null = null;
  private survivalTimer: Timer | null = null;

  constructor(private readonly options: RecoveryOptions) {}

  get state(): RendererState {
    return this.current;
  }

  crashed(details: RendererGoneDetails): void {
    this.report('error', 'output window process gone', details);
    const counts = this.pageCanFail();
    this.leavePage({kind: 'gone'});
    if (counts) this.countFailure();
  }

  /**
   * The page drew the output state, so the live picture is back. A page that
   * draws after its load was counted as failed works too: the reload waiting
   * for it is dropped.
   */
  pageDrawn(): void {
    if (this.page.kind === 'gone') return;
    this.leavePage({kind: 'live'});
    this.clear('relaunchTimer');
    this.clear('cooldownTimer');
    if (this.phase !== 'none') this.attemptWorks();
    this.showLivePicture();
  }

  /**
   * 다시 시도: while the limit waits for an attempt and the output is on, one
   * starts at once. An attempt in progress isn't interrupted.
   */
  retry(): void {
    if (this.paused || this.phase !== 'waiting') return;
    this.attemptNow();
  }

  /** The output turned on: like {@link RendererRecovery.retry}. */
  resume(): void {
    this.paused = false;
    if (this.page.kind === 'loading') this.page.load.startDrawLimit();
    this.retry();
  }

  /**
   * The output turned off: no attempt starts until it turns on again, and a
   * hidden page has no time limit to draw.
   */
  pause(): void {
    this.paused = true;
    this.clear('cooldownTimer');
    if (this.page.kind === 'loading') this.page.load.stopDrawLimit();
  }

  dispose(): void {
    this.leavePage({kind: 'gone'});
    this.clear('relaunchTimer');
    this.clear('cooldownTimer');
    this.clear('survivalTimer');
  }

  private pageCanFail(): boolean {
    return this.page.kind === 'live' || this.page.kind === 'loading';
  }

  private leavePage(next: PageStatus): void {
    if (this.page.kind === 'loading') this.page.load.settle();
    this.page = next;
  }

  private countFailure(): void {
    if (this.phase !== 'none') this.failAttempt();
    else if (this.budget.recordCrash()) this.restartQuickly();
    else this.enterLimit();
  }

  private restartQuickly(): void {
    this.setState('restarting');
    this.report('info', 'restarting an output window');
    this.clear('relaunchTimer');
    this.relaunchTimer = setTimeout(() => {
      this.relaunchTimer = null;
      this.reload();
    }, RELAUNCH_DELAY_MS);
  }

  private enterLimit(): void {
    this.setState('limited');
    this.failedAttempts = 0;
    this.clear('relaunchTimer');
    this.report(
      'error',
      'output window failed too often; showing the empty picture until a restart attempt works',
      {limit: CRASH_LIMIT},
    );
    this.waitForAttempt();
  }

  private failAttempt(): void {
    this.setState('limited');
    this.clear('survivalTimer');
    this.failedAttempts += 1;
    this.report('error', 'output window restart attempt failed', {
      attempt: this.failedAttempts,
    });
    this.waitForAttempt();
  }

  private waitForAttempt(): void {
    this.phase = 'waiting';
    this.clear('cooldownTimer');
    if (this.paused) return;
    this.cooldownTimer = setTimeout(
      () => this.attemptNow(),
      cooldownAfter(this.failedAttempts),
    );
  }

  private attemptNow(): void {
    this.clear('cooldownTimer');
    this.phase = 'attempting';
    this.report('info', 'trying to restart an output window', {
      attempt: this.failedAttempts + 1,
    });
    this.reload();
  }

  private attemptWorks(): void {
    this.phase = 'attempting';
    if (this.survivalTimer !== null) return;
    this.survivalTimer = setTimeout(() => this.endLimit(), SURVIVAL_MS);
  }

  private reload(): void {
    const load: PageLoad = new PageLoad(this.options.reload(), failure =>
      this.loadFailed(load, failure),
    );
    this.leavePage({kind: 'loading', load});
    if (!this.paused) load.startDrawLimit();
  }

  private loadFailed(load: PageLoad, failure: LoadFailure): void {
    if (this.page.kind !== 'loading' || this.page.load !== load) return;
    this.reportLoadFailure(failure);
    this.page = {kind: 'failed'};
    this.countFailure();
  }

  private reportLoadFailure(failure: LoadFailure): void {
    switch (failure.kind) {
      case 'rejected':
        this.report('error', 'output window page did not load', {
          error: failure.error,
        });
        return;
      case 'not-drawn':
        this.report('error', 'output window page did not draw in time', {
          limitMs: DRAW_LIMIT_MS,
        });
        return;
    }
  }

  private showLivePicture(): void {
    if (this.current === 'running') return;
    if (this.current === 'limited') {
      this.report('info', 'output window restart attempt works');
    }
    this.setState('running');
  }

  private endLimit(): void {
    this.survivalTimer = null;
    this.phase = 'none';
    this.failedAttempts = 0;
    this.budget.reset();
    this.report('info', 'output window restart limit ended');
  }

  private setState(state: RendererState): void {
    if (state === this.current) return;
    this.current = state;
    this.options.onStateChange?.(state);
  }

  private clear(timer: TimerName): void {
    const pending = this[timer];
    if (pending === null) return;
    clearTimeout(pending);
    this[timer] = null;
  }

  private report(
    level: 'info' | 'error',
    message: string,
    detail: object = {},
  ): void {
    this.options.log[level](message, {
      screen: this.options.screenId,
      ...detail,
    });
  }
}
