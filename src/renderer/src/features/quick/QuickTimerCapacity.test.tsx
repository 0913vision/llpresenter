import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import {parseLiveState} from '@core/schema/liveState';
import {MAX_LIVE_TIMERS} from '@core/schema/timerState';
import {expectSuccess} from '@core/schema/testHelpers';
import {useLive} from '@renderer/platform/live';
import {QuickPanel} from './QuickPanel';
import {quickDocument, quickFixture, quickId} from './quickTesting';

beforeEach(() => useLive.setState({state: emptyLiveState()}));
afterEach(() => {
  cleanup();
  delete window.llp;
  vi.restoreAllMocks();
});
const target = quickId(104);
const fullRuns = () =>
  Object.fromEntries(
    Array.from({length: MAX_LIVE_TIMERS}, (_, n) => [
      quickId(n + 1000),
      {
        state: 'running',
        since: performance.timeOrigin + performance.now(),
        countedMs: 0,
        day: 0,
      },
    ]),
  );
const setRuns = (timers: object) =>
  act(() =>
    useLive.setState({
      state: expectSuccess(parseLiveState({...emptyLiveState(), timers})),
    }),
  );
async function setup() {
  const f = quickFixture();
  const d = quickDocument();
  f.pushQuick({
    ...d,
    value: {
      ...d.value,
      items: d.value.items.filter(item => item.kind === 'timer'),
    },
  });
  window.llp = f.api;
  const send = vi.spyOn(f.api.live, 'send');
  render(<QuickPanel selectionVersion={0} onProblem={vi.fn()} />);
  const row = await screen.findByRole('button', {name: /^시작 카운트다운/});
  await waitFor(() => expect(row.textContent).toContain('1:30'));
  return {row, send};
}

it('blocks a new quick timer at capacity and re-enables it as soon as a slot is freed', async () => {
  const full = fullRuns();
  setRuns(full);
  const f = await setup();
  expect(f.row.getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(f.row);
  expect(f.send).not.toHaveBeenCalled();
  setRuns(Object.fromEntries(Object.entries(full).slice(1)));
  expect(f.row.getAttribute('aria-disabled')).not.toBe('true');
  fireEvent.click(f.row);
  await waitFor(() =>
    expect(f.send).toHaveBeenCalledExactlyOnceWith({
      type: 'timer.start',
      timerId: target,
    }),
  );
});

it('keeps an existing running reset and paused resume available at capacity', async () => {
  const remaining = Object.fromEntries(Object.entries(fullRuns()).slice(1));
  const f = await setup();
  setRuns({
    ...remaining,
    [target]: {
      state: 'paused',
      at: performance.timeOrigin + performance.now(),
      countedMs: 1000,
      day: 0,
      wallAt: Date.now(),
    },
  });
  expect(f.row.getAttribute('aria-disabled')).not.toBe('true');
  fireEvent.click(f.row);
  await waitFor(() =>
    expect(f.send).toHaveBeenLastCalledWith({
      type: 'timer.start',
      timerId: target,
    }),
  );
  f.send.mockClear();
  setRuns({
    ...remaining,
    [target]: {
      state: 'running',
      since: performance.timeOrigin + performance.now(),
      countedMs: 0,
      day: 0,
    },
  });
  expect(f.row.getAttribute('aria-disabled')).not.toBe('true');
  fireEvent.click(f.row);
  await waitFor(() =>
    expect(f.send).toHaveBeenCalledExactlyOnceWith({
      type: 'timer.reset',
      timerId: target,
    }),
  );
});
