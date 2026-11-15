import {afterEach, expect, it, vi} from 'vitest';
import {startWallClockWatcher} from '@main/live/wallClock';

afterEach(() => vi.useRealTimers());

it('publishes clock jumps and time zone changes, but not normal ticks', () => {
  vi.useFakeTimers();
  let reading = {wall: 10_000, monotonic: 5_000, timeZone: 'Asia/Seoul'};
  const publish = vi.fn();
  const stop = startWallClockWatcher(publish, () => reading);
  reading = {...reading, wall: 11_000, monotonic: 6_000};
  vi.advanceTimersByTime(1000);
  expect(publish).not.toHaveBeenCalled();
  reading = {...reading, wall: 32_000, monotonic: 7_000};
  vi.advanceTimersByTime(1000);
  expect(publish).toHaveBeenLastCalledWith(reading);
  reading = {...reading, wall: 33_000, monotonic: 8_000, timeZone: 'UTC'};
  vi.advanceTimersByTime(1000);
  expect(publish).toHaveBeenCalledTimes(2);
  expect(publish).toHaveBeenLastCalledWith(reading);
  stop();
});
