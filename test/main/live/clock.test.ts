import {describe, expect, it, vi} from 'vitest';
import {monotonicNow, SYSTEM_CLOCK} from '@main/live/clock';

let systemWall = Date.now();
vi.mock('@main/base/systemTime', () => ({systemNow: () => systemWall}));

describe('live clocks', () => {
  it('keeps the 타이머 clock moving forward when the wall clock steps back', () => {
    const wallBefore = SYSTEM_CLOCK.wall();
    const timerBefore = SYSTEM_CLOCK.timer();
    systemWall = wallBefore - 60_000;
    expect(SYSTEM_CLOCK.wall()).toBeLessThan(wallBefore);
    expect(SYSTEM_CLOCK.timer()).toBeGreaterThanOrEqual(timerBefore);
  });

  it('reads epoch-like milliseconds', () => {
    expect(Math.abs(monotonicNow() - Date.now())).toBeLessThan(60_000);
  });
});
