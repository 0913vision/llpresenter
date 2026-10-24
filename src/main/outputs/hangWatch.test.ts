import {describe, expect, it, vi} from 'vitest';
import {installFakeClock} from '../../../test/fake-clock';
import {HANG_TIMEOUT_MS, HangWatch} from './hangWatch';

describe('HangWatch', () => {
  it('calls back when the beats stop for the timeout', async () => {
    const clock = installFakeClock();
    const onHang = vi.fn();
    const watch = new HangWatch(onHang);
    watch.beat();
    await clock.advance(HANG_TIMEOUT_MS - 1);
    expect(onHang).not.toHaveBeenCalled();
    await clock.advance(1);
    expect(onHang).toHaveBeenCalledTimes(1);
  });

  it('starts over on every beat', async () => {
    const clock = installFakeClock();
    const onHang = vi.fn();
    const watch = new HangWatch(onHang);
    for (let beat = 0; beat < 10; beat += 1) {
      watch.beat();
      await clock.advance(HANG_TIMEOUT_MS - 1);
    }
    expect(onHang).not.toHaveBeenCalled();
  });

  it('stays quiet once stopped and leaves no timer', async () => {
    const clock = installFakeClock();
    const onHang = vi.fn();
    const watch = new HangWatch(onHang);
    watch.beat();
    watch.stop();
    await clock.runAll();
    expect(onHang).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
