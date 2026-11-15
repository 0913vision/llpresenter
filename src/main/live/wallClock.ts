import type {WallClockSample} from '@core/schema/wallClock';
import {monotonicNow} from './clock';

export function wallClockSample(): WallClockSample {
  return {
    wall: Date.now(),
    monotonic: monotonicNow(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  };
}

/** Publish a clock correction or timezone change, not the regular ticks. */
export function startWallClockWatcher(
  publish: (sample: WallClockSample) => void,
  sample: () => WallClockSample = wallClockSample,
): () => void {
  let previous = sample();
  const interval = setInterval(() => {
    const next = sample();
    if (
      Math.abs(
        next.wall - previous.wall - (next.monotonic - previous.monotonic),
      ) > 1000 ||
      next.timeZone !== previous.timeZone
    ) {
      publish(next);
    }
    previous = next;
  }, 1000);
  return () => clearInterval(interval);
}
