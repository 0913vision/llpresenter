import {afterEach, describe, expect, it, vi} from 'vitest';
import type {WallClockSample} from '@core/schema/wallClock';
import {stageClockText} from '@renderer/rendering/stageClock';
import {MainTimerClock} from '@renderer/rendering/mainTimerClock';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MainTimerClock', () => {
  it('redraws using main wall time and timezone after a clock jump', async () => {
    vi.spyOn(performance, 'now').mockReturnValue(100);
    let push: (value: WallClockSample) => void = () => {};
    const changed = vi.fn();
    const stop = vi.fn();
    const clock = new MainTimerClock(() => Promise.resolve(1000), vi.fn(), {
      read: () =>
        Promise.resolve({
          wall: Date.UTC(2026, 0, 1, 0),
          monotonic: 1000,
          timeZone: 'UTC',
        }),
      subscribe: listener => {
        push = listener;
        return stop;
      },
      onChange: changed,
    });
    await Promise.resolve();
    expect(
      stageClockText(clock.now().wall, '24h', {
        seconds: true,
        timeZone: clock.now().timeZone,
      }),
    ).toBe('00:00:00');
    changed.mockClear();
    push({
      wall: Date.UTC(2026, 0, 1, 2),
      monotonic: 1000,
      timeZone: 'Asia/Seoul',
    });
    expect(changed).toHaveBeenCalledOnce();
    expect(
      stageClockText(clock.now().wall, '24h', {
        seconds: true,
        timeZone: clock.now().timeZone,
      }),
    ).toBe('11:00:00');
    clock.dispose();
    expect(stop).toHaveBeenCalledOnce();
  });

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
