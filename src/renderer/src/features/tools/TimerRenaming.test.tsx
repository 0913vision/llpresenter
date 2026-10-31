import {settingsDocument} from '@core/testing/settingsDocument';
import {
  act,
  cleanup,
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {useLive} from '@renderer/session/live';
import {stageFixture} from './stageTesting';
import {TimerTab} from './TimerTab';
import {renderedToolMenuRows} from './toolMenuTesting';
import {deferred} from './testing/quickTesting';
import type {EditResult} from '@core/schema/contentEdit';

afterEach(() => {
  cleanup();
  delete window.llp;
  vi.restoreAllMocks();
});
const id = '00000000-0000-4000-8000-000000000001';
const timer = {id, name: '기존', kind: 'countdown', duration: 90};
const setup = (readOnly = false) => {
  const f = stageFixture();
  const d = settingsDocument('timers', {timers: [timer]});
  f.documents.set('timers', readOnly ? {...d, access: 'readOnly'} : d);
  return f;
};
const open = async () => {
  const contextTarget = await screen.findByRole('group', {name: '기존'});
  fireEvent.contextMenu(contextTarget, {
    clientX: 50,
    clientY: 50,
  });
  expect(contextTarget.hasAttribute('data-menu-target')).toBe(true);
  fireEvent.click(await screen.findByRole('menuitem', {name: '이름 바꾸기'}));
};

it('renames by ID, closes an applied disk warning and keeps the current run unchanged', async () => {
  const f = setup();
  const notice = vi.fn();
  f.live({
    timers: {
      [id]: {state: 'paused', at: 100, countedMs: 5000, day: 0, wallAt: 100},
    },
  });
  const before = useLive.getState().state;
  f.edit.mockImplementation(async edit => {
    if (edit.type !== 'timer.rename') throw Error('Unexpected edit');
    f.push(
      settingsDocument(
        'timers',
        {timers: [{...timer, name: edit.timerName}]},
        2,
      ),
    );
    return {
      ok: false,
      error: {
        reason: 'write-failed',
        message: 'Fixture disk',
        applied: {id, revision: 2},
        unchangedFiles: ['timers.json'],
      },
    };
  });
  render(<TimerTab onProblem={notice} />);
  await open();
  fireEvent.change(screen.getByRole('textbox', {name: '이름'}), {
    target: {value: ' 설교 '},
  });
  fireEvent.click(screen.getByRole('button', {name: '저장'}));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(f.edit).toHaveBeenCalledExactlyOnceWith({
    type: 'timer.rename',
    name: 'timers',
    timerId: id,
    timerName: '설교',
  });
  expect(screen.getByRole('group', {name: '설교'}).textContent).toContain(
    '1:25',
  );
  expect(useLive.getState().state).toBe(before);
  expect(f.send).not.toHaveBeenCalled();
  expect(notice).toHaveBeenCalledWith(
    expect.objectContaining({title: '타이머 이름 저장 실패'}),
  );
});

it('blocks empty and unchanged names, cancels, and leaves a refused rename open', async () => {
  const f = setup();
  f.edit.mockResolvedValue({
    ok: false,
    error: {reason: 'read-only', message: 'Fixture access'},
  });
  render(<TimerTab />);
  await open();
  const save = screen.getByRole('button', {name: '저장'});
  fireEvent.click(save);
  expect(f.edit).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole('textbox', {name: '이름'}), {
    target: {value: '  '},
  });
  expect(
    screen.getByRole('textbox', {name: '이름'}).getAttribute('aria-invalid'),
  ).toBe('true');
  fireEvent.click(save);
  expect(f.edit).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole('textbox', {name: '이름'}), {
    target: {value: '설교'},
  });
  fireEvent.click(save);
  await waitFor(() => expect(f.log).toHaveBeenCalledOnce());
  expect(screen.getByRole('dialog')).toBeDefined();
  fireEvent.click(screen.getByRole('button', {name: '취소'}));
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('opens the complete read-only timer menu with disabled commands', async () => {
  const f = setup(true);
  render(<TimerTab />);
  fireEvent.contextMenu(await screen.findByRole('group', {name: '기존'}));
  const menu = screen.getByRole('menu', {name: '타이머'});
  expect(renderedToolMenuRows(menu)).toEqual([
    '복제',
    '이름 바꾸기',
    '|',
    '삭제',
  ]);
  for (const row of screen.getAllByRole('menuitem')) {
    expect(row.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(row);
  }
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(f.edit).not.toHaveBeenCalled();
});

it('keeps the menu visible and disabled during a pending rename', async () => {
  const f = setup();
  const pending = deferred<EditResult>();
  f.edit.mockReturnValueOnce(pending.promise);
  render(<TimerTab />);
  await open();
  fireEvent.change(screen.getByRole('textbox', {name: '이름'}), {
    target: {value: '새 이름'},
  });
  fireEvent.click(screen.getByRole('button', {name: '저장'}));
  await waitFor(() => expect(f.edit).toHaveBeenCalledOnce());
  fireEvent.click(screen.getByRole('button', {name: '취소'}));
  fireEvent.contextMenu(screen.getByRole('group', {name: '기존'}));
  expect(
    screen
      .getByRole('menuitem', {name: '이름 바꾸기'})
      .getAttribute('aria-disabled'),
  ).toBe('true');
  await act(async () => {
    pending.resolve({ok: true, value: {id, revision: 2}});
    await pending.promise;
  });
  await waitFor(() =>
    expect(
      screen
        .getByRole('menuitem', {name: '이름 바꾸기'})
        .getAttribute('aria-disabled'),
    ).not.toBe('true'),
  );
});

it('locks an open draft when a newer read-only document arrives', async () => {
  const f = setup();
  render(<TimerTab />);
  await open();
  const input = screen.getByRole('textbox', {name: '이름'});
  fireEvent.change(input, {target: {value: '설교'}});
  act(() =>
    f.push({
      ...settingsDocument('timers', {timers: [timer]}, 2),
      access: 'readOnly',
    }),
  );
  expect(input).toHaveProperty('readOnly', true);
  fireEvent.click(screen.getByRole('button', {name: '저장'}));
  expect(f.edit).not.toHaveBeenCalled();
});

it('keeps an oversized legacy name intact and requires a shorter name before saving', async () => {
  const f = setup();
  const name = '가'.repeat(257);
  f.documents.set(
    'timers',
    settingsDocument('timers', {timers: [{...timer, name}]}),
  );
  render(<TimerTab />);
  fireEvent.contextMenu(await screen.findByRole('group', {name}));
  fireEvent.click(await screen.findByRole('menuitem', {name: '이름 바꾸기'}));
  const input = screen.getByRole('textbox', {name: '이름'});
  expect(input).toHaveProperty('value', name);
  expect(input.getAttribute('aria-invalid')).toBe('true');
  fireEvent.click(screen.getByRole('button', {name: '저장'}));
  expect(f.edit).not.toHaveBeenCalled();
});

it('opens a clock menu by keyboard after list navigation and releases subscriptions', async () => {
  const f = setup();
  f.documents.set(
    'timers',
    settingsDocument('timers', {timers: [{...timer, kind: 'clock'}]}),
  );
  const {unmount} = render(<TimerTab />);
  const group = await screen.findByRole('group', {name: '기존'});
  const list = screen.getByRole('list', {name: '타이머 목록'});
  list.focus();
  fireEvent.keyDown(list, {key: 'End'});
  expect(document.activeElement).toBe(group);
  fireEvent.keyDown(group, {key: 'F10', shiftKey: true});
  fireEvent.click(await screen.findByRole('menuitem', {name: '이름 바꾸기'}));
  expect(screen.getByRole('dialog')).toBeDefined();
  act(() => unmount());
  expect(f.count()).toBe(0);
  expect(f.send).not.toHaveBeenCalled();
});

it('keeps Home and End in the name field without scrolling a long timer list', async () => {
  const f = setup();
  const timers = Array.from({length: 100}, (_, n) => ({
    ...timer,
    id: `00000000-0000-4000-8000-${String(n + 1).padStart(12, '0')}`,
    name: `Timer ${n}`,
  }));
  f.documents.set('timers', settingsDocument('timers', {timers}));
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 320, 82),
  );
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(164);
  render(<TimerTab />);
  fireEvent.contextMenu(await screen.findByRole('group', {name: 'Timer 0'}));
  fireEvent.click(await screen.findByRole('menuitem', {name: '이름 바꾸기'}));
  const input = screen.getByRole('textbox', {name: '이름'});
  const list = screen.getByRole('list', {name: '타이머 목록'});
  fireEvent.change(input, {target: {value: '작성 중인 이름'}});
  for (const key of ['End', 'Home']) {
    const event = createEvent.keyDown(input, {key, cancelable: true});
    fireEvent(input, event);
    expect(event.defaultPrevented).toBe(false);
    expect(list.scrollTop).toBe(0);
    expect(screen.getByRole('textbox', {name: '이름'})).toBe(input);
    expect(input).toHaveProperty('value', '작성 중인 이름');
    expect(document.activeElement).toBe(input);
  }
});
