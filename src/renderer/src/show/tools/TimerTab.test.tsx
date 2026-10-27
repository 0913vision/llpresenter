import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {settingsDocument} from '@renderer/screens/testing/documents';
import {stageFixture} from './stageTesting';
import {TimerTab} from './TimerTab';
import {MAX_LIVE_TIMERS} from '@shared/schema/timerState';

afterEach(() => {
  cleanup();
  delete window.llp;
  vi.restoreAllMocks();
});
const id = '00000000-0000-4000-8000-000000000001';
const fixture = (timers: readonly object[]) => {
  const f = stageFixture();
  f.documents.set('timers', settingsDocument('timers', {timers}));
  return f;
};
const countdown = {id, name: '설교', kind: 'countdown', duration: 30};

it('starts, pauses and resets one timer without commanding another', async () => {
  const f = fixture([
    countdown,
    {...countdown, id: '00000000-0000-4000-8000-000000000002', name: '안내'},
  ]);
  const {unmount} = render(<TimerTab />);
  const group = await screen.findByRole('group', {name: '설교'});
  expect(group.textContent).toContain('0:30');
  fireEvent.click(within(group).getByRole('button', {name: '시작'}));
  expect(f.send).toHaveBeenLastCalledWith({type: 'timer.start', timerId: id});
  act(() =>
    f.live({
      timers: {
        [id]: {
          state: 'running',
          since: performance.timeOrigin + performance.now(),
          day: Date.now(),
          countedMs: 0,
        },
      },
    }),
  );
  fireEvent.click(within(group).getByRole('button', {name: '일시 정지'}));
  expect(f.send).toHaveBeenLastCalledWith({type: 'timer.pause', timerId: id});
  act(() =>
    f.live({
      timers: {
        [id]: {
          state: 'paused',
          at: performance.timeOrigin + performance.now(),
          day: Date.now(),
          wallAt: Date.now(),
          countedMs: 5000,
        },
      },
    }),
  );
  expect(group.textContent).toContain('0:25');
  fireEvent.click(within(group).getByRole('button', {name: '처음으로'}));
  expect(f.send).toHaveBeenLastCalledWith({type: 'timer.reset', timerId: id});
  expect(f.send).toHaveBeenCalledTimes(3);
  unmount();
  expect(f.count()).toBe(0);
});

it('shows each configured kind and gives a clock no start or reset controls', async () => {
  fixture([
    countdown,
    {
      id: '00000000-0000-4000-8000-000000000002',
      name: '목표',
      kind: 'countdownTo',
      date: '2026-10-28',
      time: '12:00',
    },
    {
      id: '00000000-0000-4000-8000-000000000003',
      name: '경과 타이머',
      kind: 'elapsed',
      start: 15,
    },
    {
      id: '00000000-0000-4000-8000-000000000004',
      name: '기존 경과',
      kind: 'elapsedFrom',
      time: '10:00',
    },
    {
      id: '00000000-0000-4000-8000-000000000005',
      name: '현재 시각',
      kind: 'clock',
    },
  ]);
  render(<TimerTab />);
  const clock = await screen.findByRole('group', {name: '현재 시각'});
  expect(within(clock).queryByRole('button')).toBeNull();
  expect(screen.getByRole('group', {name: '목표'}).textContent).toContain(
    '2026-10-28 12:00까지',
  );
  expect(
    screen.getByRole('group', {name: '경과 타이머'}).textContent,
  ).toContain('0:15');
  expect(screen.getByRole('group', {name: '기존 경과'}).textContent).toContain(
    '시각 경과',
  );
});

it('adds a standalone timer from an empty list, without adding a quick row', async () => {
  vi.spyOn(crypto, 'randomUUID').mockReturnValue(id);
  const f = fixture([]);
  f.edit.mockImplementation(async edit => {
    if (edit.type !== 'settings.update' || edit.name !== 'timers') {
      throw new Error('Unexpected timer edit');
    }
    f.push(settingsDocument('timers', edit.value, 2));
    return {ok: true, value: {id: 'timers', revision: 2}};
  });
  render(<TimerTab />);
  const add = screen.getByRole('button', {name: '타이머 추가'});
  await waitFor(() =>
    expect(add.getAttribute('aria-disabled')).not.toBe('true'),
  );
  fireEvent.click(add);
  fireEvent.change(screen.getByRole('textbox', {name: '초'}), {
    target: {value: '10'},
  });
  fireEvent.click(screen.getByRole('button', {name: '추가'}));
  expect(await screen.findByRole('group', {name: '타이머 1'})).toBeDefined();
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(f.edit).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({name: 'timers'}),
  );
  expect(f.send).not.toHaveBeenCalled();
});

it('disables definition creation on a read-only document', async () => {
  const f = fixture([]);
  const d = f.documents.get('timers');
  if (!d) throw new Error('Missing fixture');
  f.documents.set('timers', {...d, access: 'readOnly'});
  render(<TimerTab />);
  await waitFor(() => expect(f.count()).toBe(1));
  fireEvent.click(screen.getByRole('button', {name: '타이머 추가'}));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(f.edit).not.toHaveBeenCalled();
});

it('keeps a new start disabled at the live cap while allowing an existing paused timer to resume', async () => {
  const f = fixture([countdown]);
  const runs = Object.fromEntries(
    Array.from({length: MAX_LIVE_TIMERS}, (_, n) => [
      `00000000-0000-4000-8000-${String(n + 1000).padStart(12, '0')}`,
      {state: 'paused', at: 0, wallAt: 0, day: 0, countedMs: 0},
    ]),
  );
  f.live({timers: runs});
  render(<TimerTab />);
  const group = await screen.findByRole('group', {name: '설교'});
  const start = within(group).getByRole('button', {name: '시작'});
  expect(start.getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(start);
  expect(f.send).not.toHaveBeenCalled();
  const remaining = Object.fromEntries(Object.entries(runs).slice(1));
  act(() =>
    f.live({
      timers: {
        ...remaining,
        [id]: {state: 'paused', at: 0, wallAt: 0, day: 0, countedMs: 0},
      },
    }),
  );
  expect(start.getAttribute('aria-disabled')).not.toBe('true');
  fireEvent.click(start);
  expect(f.send).toHaveBeenCalledExactlyOnceWith({
    type: 'timer.start',
    timerId: id,
  });
});
