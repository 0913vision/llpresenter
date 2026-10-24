import type {Logger} from '../log';
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

/**
 * How long a reloaded page may take to draw the live state before the load
 * counts as failed. A reload draws in about a second (docs/spec/08-problems.md);
 * this leaves room for a busy machine without a long blank screen.
 */
export const DRAW_LIMIT_MS = 10_000;

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

type TimerName =
  'relaunchTimer' | 'cooldownTimer' | 'survivalTimer' | 'drawTimer';

type LimitPhase = 'none' | 'waiting' | 'attempting';

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
 * {@link DRAW_LIMIT_MS} fails like a crash. While the output is off, no attempt
 * starts; turning it on starts one at once, and so does 다시 시도 while the
 * output is on.
 */
export class RendererRecovery {
  private current: RendererState = 'running';
  private phase: LimitPhase = 'none';
  private failedAttempts = 0;
  private paused = false;
  private awaitingDraw = false;
  private loadId = 0;
  private readonly budget = new RestartBudget();
  private relaunchTimer: Timer | null = null;
  private cooldownTimer: Timer | null = null;
  private survivalTimer: Timer | null = null;
  private drawTimer: Timer | null = null;

  constructor(private readonly options: RecoveryOptions) {}

  get state(): RendererState {
    return this.current;
  }

  crashed(details: RendererGoneDetails): void {
    this.report('error', 'output window process gone', details);
    this.fail();
  }

  /** The page drew the output state again, so the live picture is back. */
  pageDrawn(): void {
    this.awaitingDraw = false;
    this.clear('drawTimer');
    if (this.phase === 'attempting') this.startSurvival();
    if (this.current === 'running') return;
    if (this.current === 'limited') {
      this.report('info', 'output window restart attempt works');
    }
    this.setState('running');
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
    if (this.awaitingDraw) this.startDrawLimit();
    this.retry();
  }

  /**
   * The output turned off: no attempt starts until it turns on again, and a
   * hidden page has no time limit to draw.
   */
  pause(): void {
    this.paused = true;
    this.clear('cooldownTimer');
    this.clear('drawTimer');
  }

  dispose(): void {
    this.loadId += 1;
    this.clear('relaunchTimer');
    this.clear('cooldownTimer');
    this.clear('survivalTimer');
    this.clear('drawTimer');
  }

  private fail(): void {
    this.awaitingDraw = false;
    this.clear('drawTimer');
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

  private reload(): void {
    this.loadId += 1;
    const id = this.loadId;
    this.awaitingDraw = true;
    if (!this.paused) this.startDrawLimit();
    // NOTE(0913vision): A newer load aborts an older one, whose rejection
    // then says nothing about the page now loading.
    this.options.reload().catch((error: unknown) => {
      if (id === this.loadId) this.loadFailed(error);
    });
  }

  private loadFailed(error: unknown): void {
    this.report('error', 'output window page did not load', {error});
    this.fail();
  }

  private startDrawLimit(): void {
    this.clear('drawTimer');
    this.drawTimer = setTimeout(() => {
      this.drawTimer = null;
      this.report('error', 'output window page did not draw in time', {
        limitMs: DRAW_LIMIT_MS,
      });
      this.fail();
    }, DRAW_LIMIT_MS);
  }

  private startSurvival(): void {
    if (this.survivalTimer !== null) return;
    this.survivalTimer = setTimeout(() => this.endLimit(), SURVIVAL_MS);
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
