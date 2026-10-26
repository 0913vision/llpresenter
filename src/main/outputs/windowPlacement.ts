import type {BrowserWindow} from 'electron';
import {sameRect, type Rect} from '../displays/rect';
import type {Logger} from '../log';

export const FULLSCREEN_EXIT_DEADLINE_MS = 500;
export const BOUNDS_RECHECK_MS = 100;

interface BoundsCheck {
  readonly bounds: Rect;
  readonly actual: () => Rect;
  readonly reapply: () => void;
}

/** Owns deferred fullscreen exit and one bounded correction of restored bounds. */
export class WindowPlacement {
  private leaving = false;
  private afterLeave: (() => void) | null = null;
  private exitTimer: ReturnType<typeof setTimeout> | null = null;
  private checkTimer: ReturnType<typeof setTimeout> | null = null;
  private checkSoon: ReturnType<typeof setTimeout> | null = null;
  private boundsCheck: BoundsCheck | null = null;
  private readonly left = () => {
    if (!this.leaving) return;
    this.clearExitTimer();
    this.exitTimer = setTimeout(() => this.finishLeaving(), 0);
  };
  private readonly moved = () => {
    if (this.boundsCheck === null || this.checkSoon !== null) return;
    this.checkSoon = setTimeout(() => {
      this.checkSoon = null;
      this.correctBounds();
    }, 0);
  };

  constructor(
    private readonly win: BrowserWindow,
    private readonly log: Logger,
  ) {
    win.on('leave-full-screen', this.left);
    win.on('move', this.moved);
    win.on('resize', this.moved);
  }

  windowed(place: () => void): void {
    this.cancel();
    if (!this.leaving && !this.win.isFullScreen()) {
      place();
      return;
    }
    this.afterLeave = place;
    if (this.leaving) return;
    this.leaving = true;
    this.exitTimer = setTimeout(
      () => this.finishLeaving(),
      FULLSCREEN_EXIT_DEADLINE_MS,
    );
    try {
      this.win.setFullScreen(false);
    } catch (error) {
      this.clearExitTimer();
      this.leaving = false;
      this.afterLeave = null;
      throw error;
    }
  }

  fullscreen(place: () => void): void {
    this.cancel();
    if (this.leaving) this.afterLeave = place;
    else place();
  }

  verifyBounds(bounds: Rect, afterReapply: () => void): void {
    this.verify({
      bounds,
      actual: () => this.win.getBounds(),
      reapply: () => {
        this.win.setBounds(bounds);
        afterReapply();
      },
    });
  }

  verifyContentBounds(bounds: Rect, afterReapply: () => void): void {
    this.verify({
      bounds,
      actual: () => this.win.getContentBounds(),
      reapply: () => {
        this.win.setContentBounds(bounds);
        afterReapply();
      },
    });
  }

  private verify(check: BoundsCheck): void {
    this.clearCheck();
    this.boundsCheck = check;
    this.checkTimer = setTimeout(() => {
      this.correctBounds();
      this.clearCheck();
    }, BOUNDS_RECHECK_MS);
  }

  /** Whether a deferred placement or a bounds check is still running. */
  isPending(): boolean {
    return this.leaving || this.boundsCheck !== null;
  }

  cancel(): void {
    this.afterLeave = null;
    this.clearCheck();
  }

  dispose(): void {
    this.cancel();
    this.clearExitTimer();
    this.leaving = false;
    this.win.removeListener('leave-full-screen', this.left);
    this.win.removeListener('move', this.moved);
    this.win.removeListener('resize', this.moved);
  }

  private finishLeaving(): void {
    this.clearExitTimer();
    this.leaving = false;
    const place = this.afterLeave;
    this.afterLeave = null;
    try {
      place?.();
    } catch (error) {
      this.log.error(
        'could not place the output after leaving full screen',
        error,
      );
    }
  }

  private correctBounds(): void {
    const check = this.boundsCheck;
    if (check === null) return;
    try {
      if (sameRect(check.actual(), check.bounds)) return;
      this.clearCheck();
      check.reapply();
    } catch (error) {
      this.clearCheck();
      this.log.error('could not correct restored output bounds', error);
    }
  }

  private clearExitTimer(): void {
    if (this.exitTimer !== null) clearTimeout(this.exitTimer);
    this.exitTimer = null;
  }

  private clearCheck(): void {
    if (this.checkTimer !== null) clearTimeout(this.checkTimer);
    if (this.checkSoon !== null) clearTimeout(this.checkSoon);
    this.checkTimer = null;
    this.checkSoon = null;
    this.boundsCheck = null;
  }
}
