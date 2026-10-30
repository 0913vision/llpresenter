import type {TimerNow} from '@core/timers/timerClock';

/**
 * Main's monotonic 타이머 clock as one window reads it: this window's own
 * monotonic clock plus one offset, taken from a single round trip at start
 * (its midpoint). Until the answer arrives, both processes' time origins
 * stand in, which agree unless the computer's clock was corrected between
 * their starts.
 */
export class MainTimerClock {
  private offset = performance.timeOrigin;

  constructor(
    read: () => Promise<number>,
    onError: (message: string, error: unknown) => void,
  ) {
    const before = performance.now();
    read().then(
      main => {
        this.offset = main - (before + performance.now()) / 2;
      },
      (error: unknown) => onError('could not read the 타이머 clock', error),
    );
  }

  readonly now = (): TimerNow => ({
    timer: performance.now() + this.offset,
    wall: Date.now(),
  });
}
