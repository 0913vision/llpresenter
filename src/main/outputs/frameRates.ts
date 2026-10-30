import type {FrameRateReport} from '@core/schema/ipcPayloads';
import type {Logger} from '../log';

/** The frame rate output windows aim for (docs/spec/03-output.md). */
export const TARGET_FPS = 60;

/** A rate more than this share below the target is low. */
export const LOW_FPS_SHARE = 0.1;

/** How long a rate must stay low, or back at the target, before its status changes. */
export const FPS_SETTLE_MS = 2000;

export type FrameRateStatus = 'normal' | 'low';

/** One screen's last reported frame rate. */
export interface ScreenFrameRate {
  readonly screen: string;
  readonly fps: number;
}

/** A screen's last reported rate and its status. */
export interface FrameRate {
  readonly fps: number;
  readonly status: FrameRateStatus;
}

interface ScreenRate extends FrameRate {
  readonly disagreeingSince: number | null;
}

// NOTE(0913vision): The meter reports one decimal and a 60 Hz screen measures
// 59.9 to 60.1, so a rate this close to the target counts as at the target.
const TARGET_TOLERANCE_FPS = 0.5;

function isLow(fps: number): boolean {
  return fps < TARGET_FPS * (1 - LOW_FPS_SHARE);
}

function isAtTarget(fps: number): boolean {
  return fps >= TARGET_FPS - TARGET_TOLERANCE_FPS;
}

function argueForChange(status: FrameRateStatus, fps: number): boolean {
  return status === 'normal' ? isLow(fps) : isAtTarget(fps);
}

function otherStatus(status: FrameRateStatus): FrameRateStatus {
  return status === 'normal' ? 'low' : 'normal';
}

/**
 * Keeps the last frame rate each output window reported, and turns a screen's
 * status to low when its rate stays more than 10% below the target for 2
 * seconds, and back after 2 seconds at the target (docs/spec/03-output.md,
 * `StatusBar` README).
 */
export class FrameRateTracker {
  private readonly rates = new Map<string, ScreenRate>();

  constructor(
    private readonly isKnownScreen: (screenId: string) => boolean,
    private readonly log: Logger,
    private readonly now: () => number = Date.now,
  ) {}

  /** Takes one report. A report for a screen that doesn't exist is ignored. */
  report({screenId, fps}: FrameRateReport): void {
    if (!this.isKnownScreen(screenId)) return;
    const previous = this.rates.get(screenId);
    const status = previous?.status ?? 'normal';
    if (!argueForChange(status, fps)) {
      this.rates.set(screenId, {fps, status, disagreeingSince: null});
      return;
    }
    const since = previous?.disagreeingSince ?? this.now();
    if (this.now() - since < FPS_SETTLE_MS) {
      this.rates.set(screenId, {fps, status, disagreeingSince: since});
      return;
    }
    const changed = otherStatus(status);
    this.rates.set(screenId, {fps, status: changed, disagreeingSince: null});
    this.logChange(screenId, changed, fps);
  }

  /** The last rate and status of a screen, or null before its first report. */
  current(screenId: string): FrameRate | null {
    const rate = this.rates.get(screenId);
    return rate === undefined ? null : {fps: rate.fps, status: rate.status};
  }

  /** Drops a screen's rate and status, so its next report starts fresh. */
  forget(screenId: string): void {
    this.rates.delete(screenId);
  }

  retain(screenIds: readonly string[]): void {
    const known = new Set(screenIds);
    for (const id of this.rates.keys()) {
      if (!known.has(id)) this.rates.delete(id);
    }
  }

  /** The last rate of each of these screens that has reported, in their order. */
  reported(screenIds: readonly string[]): readonly ScreenFrameRate[] {
    return screenIds.flatMap(screen => {
      const rate = this.rates.get(screen);
      return rate === undefined ? [] : [{screen, fps: rate.fps}];
    });
  }

  private logChange(
    screenId: string,
    status: FrameRateStatus,
    fps: number,
  ): void {
    const detail = {screen: screenId, fps};
    if (status === 'low') {
      this.log.warn('output frame rate low', detail);
      return;
    }
    this.log.info('output frame rate back at the target', detail);
  }
}
