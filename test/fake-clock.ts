import {onTestFinished, vi} from 'vitest';

/** The time a fake clock starts at unless a test picks another. */
export const FAKE_CLOCK_START = new Date('2026-01-04T09:00:00.000Z');

/** Controls time in a test that installed a fake clock. */
export interface FakeClock {
  /**
   * Moves time forward and runs the timers that come due on the way,
   * including ones they schedule, letting promises settle between them.
   */
  advance(milliseconds: number): Promise<void>;
  /** Runs every pending timer until none is left. */
  runAll(): Promise<void>;
  /** The current fake time. */
  now(): Date;
}

/**
 * Replaces `Date` and the timer functions with fakes until the current test
 * finishes, so tests that wait or read the time are fast and repeat exactly.
 * Call it inside a test or a `beforeEach` hook.
 *
 * @param start - the time the clock starts at
 */
export function installFakeClock(start: Date = FAKE_CLOCK_START): FakeClock {
  vi.useFakeTimers({now: start});
  onTestFinished(() => {
    vi.useRealTimers();
  });
  return {
    advance: async milliseconds => {
      await vi.advanceTimersByTimeAsync(milliseconds);
    },
    runAll: async () => {
      await vi.runAllTimersAsync();
    },
    now: () => new Date(Date.now()),
  };
}
