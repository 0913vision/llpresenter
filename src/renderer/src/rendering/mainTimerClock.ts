import type {TimerNow} from '@core/timers';
import type {WallClockSample} from '@core/schema/wallClock';

/**
 * Main's monotonic 타이머 clock as one window reads it: this window's own
 * monotonic clock plus one offset, taken from a single round trip at start
 * (its midpoint). Until the answer arrives, both processes' time origins
 * stand in, which agree unless the computer's clock was corrected between
 * their starts.
 * Wall time is read from the system on each tick; main's wall notifications
 * supply the timezone and prompt a redraw after a correction.
 */
export class MainTimerClock {
  private offset = performance.timeOrigin;
  private timeZone: string | undefined;
  private stopWall: (() => void) | undefined;
  private generation = 0;
  private disposed = false;

  constructor(
    read: () => Promise<number>,
    private readonly onError: (message: string, error: unknown) => void,
    private readonly wall?: {
      read: () => Promise<WallClockSample>;
      subscribe: (listener: (value: WallClockSample) => void) => () => void;
      onChange: () => void;
    },
  ) {
    this.resume();
    const before = performance.now();
    read().then(
      main => {
        if (this.disposed) return;
        this.offset = main - (before + performance.now()) / 2;
        this.wall?.onChange();
      },
      (error: unknown) => onError('could not read the 타이머 clock', error),
    );
  }

  readonly now = (): TimerNow => ({
    timer: performance.now() + this.offset,
    wall: Date.now(),
    ...(this.timeZone === undefined ? {} : {timeZone: this.timeZone}),
  });
  resume(): void {
    const wall = this.wall;
    if (wall === undefined || this.disposed || this.stopWall !== undefined) {
      return;
    }
    const generation = ++this.generation;
    let pushed = false;
    const accept = (value: WallClockSample): void => {
      if (this.disposed || generation !== this.generation) return;
      this.timeZone = value.timeZone;
      wall.onChange();
    };
    this.stopWall = wall.subscribe(value => {
      pushed = true;
      accept(value);
    });
    wall.read().then(
      value => {
        if (!pushed) accept(value);
      },
      (error: unknown) => this.onError('could not read the wall clock', error),
    );
  }
  suspend(): void {
    this.generation++;
    this.stopWall?.();
    this.stopWall = undefined;
  }

  dispose(): void {
    this.disposed = true;
    this.suspend();
  }
}
