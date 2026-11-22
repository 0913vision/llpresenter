import {act, cleanup, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {emptyLiveState} from '@core/schema/live';
import {parseLiveState} from '@core/schema/liveState';
import {parseSettingsDocument} from '@core/schema/settingsDocuments';
import {expectSuccess} from '@fixtures/core/schema/testHelpers';
import {TimerValue} from '@renderer/features/tools/TimerValue';

const id = '00000000-0000-4000-8000-000000000001';
let elapsed = 0;
beforeEach(() => {
  vi.useFakeTimers();
  elapsed = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => elapsed);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function fixture() {
  const document = expectSuccess(
    parseSettingsDocument({
      name: 'timers',
      revision: 1,
      access: 'editable',
      value: {
        format: 'llsettings.timers',
        schemaVersion: 1,
        timers: [{id, name: '검증', kind: 'countdown', duration: 2}],
      },
    }),
  );
  if (document.name !== 'timers' || !document.value.timers[0]) {
    throw new Error('Invalid timer fixture');
  }
  const timer = document.value.timers[0];
  const live = expectSuccess(
    parseLiveState({
      ...emptyLiveState(),
      timers: {
        [id]: {
          state: 'running',
          since: performance.timeOrigin,
          countedMs: 0,
          day: Date.now(),
        },
      },
    }),
  );
  const run = live.timers?.[timer.id];
  const clock = vi.fn(async () => performance.timeOrigin);
  const write = vi.fn();
  const api = mockLlpApi({live: {clock}, log: {write}});
  return {api, timer, run, clock, write};
}

describe('timer values and their shared clock', () => {
  it('updates control clock and time-of-day countdown after a wall jump', async () => {
    const wall = Date.UTC(2026, 0, 1, 10);
    vi.setSystemTime(wall);
    const f = fixture();
    const clockTimer = {...f.timer, kind: 'clock' as const};
    const target = {
      ...f.timer,
      kind: 'countdownTo' as const,
      time: '10:30',
    };
    const running = {
      state: 'running' as const,
      since: performance.timeOrigin,
      countedMs: 0,
      day: wall,
    };
    render(
      <>
        <TimerValue api={f.api} timer={clockTimer} run={undefined} />
        <TimerValue api={f.api} timer={target} run={running} />
      </>,
    );
    await act(async () => undefined);
    expect(screen.getByText('10:00:00')).toBeDefined();
    expect(screen.getByText('30:00')).toBeDefined();
    act(() => {
      vi.setSystemTime(wall + 5 * 60_000);
      vi.advanceTimersByTime(250);
    });
    expect(screen.getByText('10:05:00')).toBeDefined();
    expect(screen.getByText('25:00')).toBeDefined();
  });

  it('shows the configured value, keeps a minus after zero, and releases ticking on reset', async () => {
    const f = fixture();
    const view = render(
      <TimerValue api={f.api} timer={f.timer} run={undefined} />,
    );
    expect(screen.getByText('0:02')).toBeDefined();
    expect(vi.getTimerCount()).toBe(0);
    view.rerender(<TimerValue api={f.api} timer={f.timer} run={f.run} />);
    await act(async () => undefined);
    elapsed = 3100;
    act(() => {
      vi.advanceTimersByTime(3100);
    });
    expect(screen.getByText('-0:01')).toBeDefined();
    view.rerender(<TimerValue api={f.api} timer={f.timer} run={undefined} />);
    expect(screen.getByText('0:02')).toBeDefined();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('shares one interval, releases its final listener and can start again', async () => {
    const f = fixture();
    const stopWall = vi.fn();
    const subscribeWall = vi
      .spyOn(f.api.live, 'subscribeWallClock')
      .mockReturnValue(stopWall);
    const value = <TimerValue api={f.api} timer={f.timer} run={f.run} />;
    const view = render(
      <>
        {value}
        {value}
      </>,
    );
    await act(async () => undefined);
    expect(vi.getTimerCount()).toBe(1);
    view.rerender(value);
    expect(vi.getTimerCount()).toBe(1);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(stopWall).toHaveBeenCalledOnce();
    const again = render(value);
    expect(vi.getTimerCount()).toBe(1);
    expect(f.clock).toHaveBeenCalledOnce();
    expect(subscribeWall).toHaveBeenCalledTimes(2);
    again.unmount();
    expect(stopWall).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('logs a failed clock read and keeps the monotonic fallback working', async () => {
    const f = fixture();
    f.clock.mockImplementation(() => {
      throw new Error('Invented clock failure');
    });
    render(<TimerValue api={f.api} timer={f.timer} run={f.run} />);
    await act(async () => undefined);
    expect(f.write).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'error',
        detail: 'Invented clock failure',
      }),
    );
    elapsed = 3100;
    act(() => {
      vi.advanceTimersByTime(3100);
    });
    expect(screen.getByText('-0:01')).toBeDefined();
  });
});
