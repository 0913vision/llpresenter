import type {FrameRateReport} from '@shared/schema/ipcPayloads';
import type {Logger} from '../log';

/** The frame rate output windows aim for (docs/spec/03-output.md). */
export const TARGET_FPS = 60;

/** A rate more than this share below the target is low. */
export const LOW_FPS_SHARE = 0.1;

/** How long a rate must stay low, or back at the target, before its status changes. */
export const FPS_SETTLE_MS = 2000;

export type FrameRateStatus = 'normal' | 'low';

/** A screen's last reported rate and its status. */
export interface FrameRate {
  readonly fps: number;
  readonly status: FrameRateStatus;
}

interface ScreenRate extends FrameRate {
  readonly disagreeingSince: number | null;
}

function observedStatus(fps: number): FrameRateStatus {
  return fps < TARGET_FPS * (1 - LOW_FPS_SHARE) ? 'low' : 'normal';
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
    if (observedStatus(fps) === status) {
      this.rates.set(screenId, {fps, status, disagreeingSince: null});
      return;
    }
    const since = previous?.disagreeingSince ?? this.now();
    if (this.now() - since < FPS_SETTLE_MS) {
      this.rates.set(screenId, {fps, status, disagreeingSince: since});
      return;
    }
    this.rates.set(screenId, {
      fps,
      status: observedStatus(fps),
      disagreeingSince: null,
    });
    this.logChange(screenId, fps);
  }

  /** The last rate and status of a screen, or null before its first report. */
  current(screenId: string): FrameRate | null {
    const rate = this.rates.get(screenId);
    return rate === undefined ? null : {fps: rate.fps, status: rate.status};
  }

  private logChange(screenId: string, fps: number): void {
    const detail = {screen: screenId, fps};
    if (observedStatus(fps) === 'low') {
      this.log.warn('output frame rate low', detail);
      return;
    }
    this.log.info('output frame rate back at the target', detail);
  }
}
