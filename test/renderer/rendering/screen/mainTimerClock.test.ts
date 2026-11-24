import {afterEach, describe, expect, it, vi} from 'vitest';
import type {WallClockSample} from '@core/schema/app/wallClock';
import {stageClockText} from '@renderer/rendering/layers/stageClock';
import {MainTimerClock} from '@renderer/rendering/screen/mainTimerClock';
import {timerText} from '@core/timers/timerClock';
import {createTimerId} from '@core/schema/common/ids';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MainTimerClock', () => {
  it('follows a wall-clock jump from main at once without moving elapsed timers', async () => {
    let wall = Date.UTC(2026, 0, 1, 10);
    vi.spyOn(Date, 'now').mockImplementation(() => wall);
    const monotonic = vi.spyOn(performance, 'now').mockReturnValue(100);
    let push: (value: WallClockSample) => void = () => undefined;
    const clock = new MainTimerClock(() => Promise.resolve(1000), vi.fn(), {
      read: async () => ({wall, monotonic: 1000, timeZone: 'UTC'}),
      subscribe: listener => {
        push = listener;
        return () => undefined;
      },
      onChange: vi.fn(),
    });
    await Promise.resolve();
    const id = createTimerId('00000000-0000-4000-8000-000000000090');
    const target = {
      id,
      name: 'Target',
      kind: 'countdownTo' as const,
      time: '10:30',
    };
    const elapsed = {id, name: 'Elapsed', kind: 'elapsed' as const, start: 0};
    const run = {
      state: 'running' as const,
      since: 1000,
      countedMs: 0,
      day: wall,
    };
    expect(timerText(target, run, clock.now())).toBe('30:00');
    wall += 5 * 60_000;
    monotonic.mockReturnValue(1100);
    push({wall, monotonic: 2000, timeZone: 'UTC'});
    expect(
      stageClockText(clock.now().wall, '24h', {seconds: true, timeZone: 'UTC'}),
    ).toBe('10:05:00');
    expect(timerText(target, run, clock.now())).toBe('25:00');
    expect(timerText(elapsed, run, clock.now())).toBe('0:01');
    wall -= 5 * 60_000;
    push({wall, monotonic: 2000, timeZone: 'UTC'});
    expect(timerText(target, run, clock.now())).toBe('30:00');
    expect(timerText(elapsed, run, clock.now())).toBe('0:01');
    clock.dispose();
  });
  it('redraws using main wall time and timezone after a clock jump', async () => {
    vi.spyOn(performance, 'now').mockReturnValue(100);
    let wall = Date.UTC(2026, 0, 1, 0);
    vi.spyOn(Date, 'now').mockImplementation(() => wall);
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
    wall = Date.UTC(2026, 0, 1, 2);
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
    clock.suspend();
    expect(stop).toHaveBeenCalledOnce();
    clock.resume();
    changed.mockClear();
    wall = Date.UTC(2026, 0, 1, 3);
    push({wall: Date.UTC(2026, 0, 1, 3), monotonic: 1000, timeZone: 'UTC'});
    expect(changed).toHaveBeenCalledOnce();
    expect(
      stageClockText(clock.now().wall, '24h', {
        seconds: true,
        timeZone: clock.now().timeZone,
      }),
    ).toBe('03:00:00');
    clock.dispose();
    expect(stop).toHaveBeenCalledTimes(2);
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
