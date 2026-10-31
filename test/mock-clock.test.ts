import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {MOCK_CLOCK_START, installMockClock} from './mock-clock';

describe('installMockClock', () => {
  it('starts at the fixed start time', () => {
    const clock = installMockClock();
    expect(clock.now()).toEqual(MOCK_CLOCK_START);
    expect(new Date()).toEqual(MOCK_CLOCK_START);
  });

  it('starts at the time the test picks', () => {
    const start = new Date('2026-03-01T00:00:00.000Z');
    expect(installMockClock(start).now()).toEqual(start);
  });

  it('runs only the timers that come due', async () => {
    const clock = installMockClock();
    const fired: string[] = [];
    setTimeout(() => fired.push('soon'), 1000);
    setTimeout(() => fired.push('later'), 5000);
    await clock.advance(1000);
    expect(fired).toEqual(['soon']);
    expect(clock.now().getTime() - MOCK_CLOCK_START.getTime()).toBe(1000);
  });

  it('lets microtasks run between timers', async () => {
    const clock = installMockClock();
    const fired: string[] = [];
    setTimeout(() => {
      queueMicrotask(() => {
        setTimeout(() => fired.push('chained'), 10);
      });
    }, 10);
    await clock.advance(20);
    expect(fired).toEqual(['chained']);
  });

  it('runs every pending timer', async () => {
    const clock = installMockClock();
    let count = 0;
    setTimeout(() => (count += 1), 60_000);
    setTimeout(() => (count += 1), 3_600_000);
    await clock.runAll();
    expect(count).toBe(2);
  });

  it('gives back the real timers when the test finishes', () => {
    onTestFinished(() => {
      expect(vi.isFakeTimers()).toBe(false);
    });
    installMockClock();
    expect(vi.isFakeTimers()).toBe(true);
  });
});
