import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {FAKE_CLOCK_START, installFakeClock} from './fake-clock';

describe('installFakeClock', () => {
  it('starts at the fixed start time', () => {
    const clock = installFakeClock();
    expect(clock.now()).toEqual(FAKE_CLOCK_START);
    expect(new Date()).toEqual(FAKE_CLOCK_START);
  });

  it('starts at the time the test picks', () => {
    const start = new Date('2026-03-01T00:00:00.000Z');
    expect(installFakeClock(start).now()).toEqual(start);
  });

  it('runs only the timers that come due', async () => {
    const clock = installFakeClock();
    const fired: string[] = [];
    setTimeout(() => fired.push('soon'), 1000);
    setTimeout(() => fired.push('later'), 5000);
    await clock.advance(1000);
    expect(fired).toEqual(['soon']);
    expect(clock.now().getTime() - FAKE_CLOCK_START.getTime()).toBe(1000);
  });

  it('lets promises settle between timers', async () => {
    const clock = installFakeClock();
    const fired: string[] = [];
    setTimeout(() => {
      void Promise.resolve().then(() => {
        setTimeout(() => fired.push('chained'), 10);
      });
    }, 10);
    await clock.advance(20);
    expect(fired).toEqual(['chained']);
  });

  it('runs every pending timer', async () => {
    const clock = installFakeClock();
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
    installFakeClock();
    expect(vi.isFakeTimers()).toBe(true);
  });
});
