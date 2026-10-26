/**
 * The clocks the live state reads: the wall clock for times of day and
 * deadlines, and main's monotonic 타이머 clock, which never steps back.
 */
export interface LiveClock {
  readonly wall: () => number;
  readonly timer: () => number;
}

/** Epoch-like milliseconds that a wall-clock correction never moves. */
export function monotonicNow(): number {
  return performance.timeOrigin + performance.now();
}

export const SYSTEM_CLOCK: LiveClock = {
  wall: () => Date.now(),
  timer: () => monotonicNow(),
};
