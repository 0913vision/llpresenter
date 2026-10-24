import type {Logger} from '../log';
import {CRASH_LIMIT, RestartBudget} from './restartBudget';

/**
 * What an output window's renderer is doing: running, reloading after a
 * crash, or held at the empty picture between attempts after repeated crashes
 * (docs/spec/08-problems.md).
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

/** How long an attempt must run without dying to end the restart limit. */
export const SURVIVAL_MS = 60_000;

/** The arguments of the {@link RendererRecovery} constructor. */
export interface RecoveryOptions {
  readonly screenId: string;
  readonly reload: () => void;
  readonly log: Logger;
}

type Timer = ReturnType<typeof setTimeout>;

function cooldownAfter(failedAttempts: number): number {
  return (
    COOLDOWN_STEPS_MS[Math.min(failedAttempts, COOLDOWN_STEPS_MS.length - 1)] ??
    SURVIVAL_MS
  );
}

/**
 * Brings an output window's renderer back after crashes. The first crashes
 * reload the page at once. After {@link CRASH_LIMIT} crashes in a minute, the
 * window keeps showing its empty picture and tries again after a cool-down; an
 * attempt that runs for a minute ends the limit. While the output is off, no
 * attempts are made; turning it on tries at once.
 */
export class RendererRecovery {
  private current: RendererState = 'running';
  private failedAttempts = 0;
  private paused = false;
  private readonly budget = new RestartBudget();
  private relaunchTimer: Timer | null = null;
  private attemptTimer: Timer | null = null;
  private survivalTimer: Timer | null = null;

  constructor(private readonly options: RecoveryOptions) {}

  get state(): RendererState {
    return this.current;
  }

  crashed(details: RendererGoneDetails): void {
    if (this.current === 'limited') this.failAttempt(details);
    else if (this.budget.recordCrash()) this.restartQuickly(details);
    else this.enterLimit(details);
  }

  /** The output turned on: while the limit holds, an attempt starts at once. */
  resume(): void {
    this.paused = false;
    if (this.current === 'limited' && this.survivalTimer === null) {
      this.attemptNow();
    }
  }

  /** The output turned off: no more attempts until it turns on again. */
  pause(): void {
    this.paused = true;
    this.clear('attemptTimer');
  }

  dispose(): void {
    this.clear('relaunchTimer');
    this.clear('attemptTimer');
    this.clear('survivalTimer');
  }

  private restartQuickly(details: RendererGoneDetails): void {
    this.current = 'restarting';
    this.report('error', 'output window process gone, restarting it', details);
    this.clear('relaunchTimer');
    this.relaunchTimer = setTimeout(() => {
      this.relaunchTimer = null;
      this.current = 'running';
      this.options.reload();
    }, RELAUNCH_DELAY_MS);
  }

  private enterLimit(details: RendererGoneDetails): void {
    this.current = 'limited';
    this.failedAttempts = 0;
    this.clear('relaunchTimer');
    this.report(
      'error',
      'output window crashed too often; showing the empty picture until a restart attempt works',
      {...details, limit: CRASH_LIMIT},
    );
    this.scheduleAttempt();
  }

  private failAttempt(details: RendererGoneDetails): void {
    this.clear('survivalTimer');
    this.failedAttempts += 1;
    this.report('error', 'output window restart attempt failed', {
      ...details,
      attempt: this.failedAttempts,
    });
    if (!this.paused) this.scheduleAttempt();
  }

  private scheduleAttempt(): void {
    this.clear('attemptTimer');
    this.attemptTimer = setTimeout(
      () => this.attemptNow(),
      cooldownAfter(this.failedAttempts),
    );
  }

  private attemptNow(): void {
    this.clear('attemptTimer');
    this.report('info', 'trying to restart an output window', {
      attempt: this.failedAttempts + 1,
    });
    this.options.reload();
    this.clear('survivalTimer');
    this.survivalTimer = setTimeout(() => this.endLimit(), SURVIVAL_MS);
  }

  private endLimit(): void {
    this.survivalTimer = null;
    this.current = 'running';
    this.failedAttempts = 0;
    this.budget.reset();
    this.report('info', 'output window running again after the restart limit');
  }

  private clear(
    timer: 'relaunchTimer' | 'attemptTimer' | 'survivalTimer',
  ): void {
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
