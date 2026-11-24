import type {WallClockSample} from '@core/schema/app/wallClock';
import {systemNow} from '../base/systemTime';
import {monotonicNow} from './clock';

/** How far the wall clock may move from the last published sample before windows hear of it. */
const DRIFT_MS = 500;

export function wallClockSample(): WallClockSample {
  return {
    wall: systemNow(),
    monotonic: monotonicNow(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  };
}

/**
 * Publish a clock correction, a slow drift past half a second, or a timezone
 * change; not the regular ticks. Windows draw wall time from the last
 * published sample and their own steady clock.
 */
export function startWallClockWatcher(
  publish: (sample: WallClockSample) => void,
  sample: () => WallClockSample = wallClockSample,
): () => void {
  let published = sample();
  const interval = setInterval(() => {
    const next = sample();
    if (
      Math.abs(
        next.wall - published.wall - (next.monotonic - published.monotonic),
      ) > DRIFT_MS ||
      next.timeZone !== published.timeZone
    ) {
      publish(next);
      published = next;
    }
  }, 1000);
  return () => clearInterval(interval);
}
