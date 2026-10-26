import {describe, expect, it, vi} from 'vitest';
import {monotonicNow, SYSTEM_CLOCK} from './clock';

describe('live clocks', () => {
  it('keeps the 타이머 clock moving forward when the wall clock steps back', () => {
    vi.useFakeTimers({toFake: ['Date']});
    try {
      vi.setSystemTime(Date.now());
      const wallBefore = SYSTEM_CLOCK.wall();
      const timerBefore = SYSTEM_CLOCK.timer();
      vi.setSystemTime(wallBefore - 60_000);
      expect(SYSTEM_CLOCK.wall()).toBeLessThan(wallBefore);
      expect(SYSTEM_CLOCK.timer()).toBeGreaterThanOrEqual(timerBefore);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reads epoch-like milliseconds', () => {
    expect(Math.abs(monotonicNow() - Date.now())).toBeLessThan(60_000);
  });
});
