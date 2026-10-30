import {afterEach, describe, expect, it, vi} from 'vitest';
import {MainTimerClock} from './mainTimerClock';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MainTimerClock', () => {
  it("reads main's clock through the offset of one round trip's midpoint", async () => {
    const local = vi.spyOn(performance, 'now');
    local.mockReturnValueOnce(100).mockReturnValueOnce(140);
    let answer: (main: number) => void = () => undefined;
    const clock = new MainTimerClock(
      () =>
        new Promise(resolve => {
          answer = resolve;
        }),
      vi.fn(),
    );
    answer(10_000);
    await Promise.resolve();
    local.mockReturnValue(200);
    expect(clock.now().timer).toBe(10_080);
  });

  it('uses the time origin until the answer comes, and keeps it after a failure', async () => {
    const onError = vi.fn();
    const local = vi.spyOn(performance, 'now').mockReturnValue(50);
    const clock = new MainTimerClock(
      () => Promise.reject(new Error('no main')),
      onError,
    );
    expect(clock.now().timer).toBe(performance.timeOrigin + 50);
    await vi.waitFor(() => expect(onError).toHaveBeenCalledOnce());
    local.mockReturnValue(80);
    expect(clock.now().timer).toBe(performance.timeOrigin + 80);
    expect(Math.abs(clock.now().wall - Date.now())).toBeLessThan(1000);
  });
});
