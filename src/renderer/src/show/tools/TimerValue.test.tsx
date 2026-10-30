import {act, cleanup, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {fakeLlpApi} from '@contracts/ipc/testing/fakeLlpApi';
import {emptyLiveState} from '@core/live/state';
import {parseLiveState} from '@core/schema/liveState';
import {parseSettingsDocument} from '@core/schema/settingsDocuments';
import {expectSuccess} from '@core/schema/testHelpers';
import {TimerValue} from './TimerValue';

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
  const api = fakeLlpApi({live: {clock}, log: {write}});
  return {api, timer, run, clock, write};
}

describe('timer values and their shared clock', () => {
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
    const again = render(value);
    expect(vi.getTimerCount()).toBe(1);
    expect(f.clock).toHaveBeenCalledOnce();
    again.unmount();
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
