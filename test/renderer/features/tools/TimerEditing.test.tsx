import {settingsDocument} from '@fixtures/core/settingsDocument';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {useLive} from '@renderer/session/live';
import {stageFixture} from '@fixtures/renderer/features/tools/stageTesting';
import {TimerTab} from '@renderer/features/tools/TimerTab';
import {QuickRowEditor} from '@renderer/features/quick/QuickEditing';
import {quickItem} from '@fixtures/renderer/features/tools/quickTesting';
import {renderedToolMenuRows} from '@fixtures/renderer/features/tools/toolMenuTesting';
import type {LlpApi} from '@contracts/ipc/api';
import {createTimerId} from '@core/schema/ids';
import type {Timer} from '@core/schema/timers';

afterEach(() => {
  cleanup();
  delete window.llp;
  vi.restoreAllMocks();
});
const id = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const timers = [
  {id, name: '점검', kind: 'countdown', duration: 60},
  {id: other, name: '시계', kind: 'clock'},
];
const setup = (readOnly = false) => {
  const f = stageFixture();
  const d = settingsDocument('timers', {timers});
  f.documents.set('timers', readOnly ? {...d, access: 'readOnly'} : d);
  f.edit.mockImplementation(edit => {
    if (edit.type !== 'settings.update' || edit.name !== 'timers') {
      throw new Error('Unexpected edit');
    }
    f.push(settingsDocument('timers', edit.value, edit.baseRevision + 1));
    return Promise.resolve({
      ok: true,
      value: {id: 'timers', revision: edit.baseRevision + 1},
    });
  });
  return f;
};
const written = (f: ReturnType<typeof setup>) => {
  const edit = f.edit.mock.calls[0]?.[0];
  if (edit?.type !== 'settings.update' || edit.name !== 'timers') {
    throw new Error('No timer update was written');
  }
  return edit.value.timers;
};
const change = (label: string, value: string) =>
  fireEvent.change(screen.getByRole('textbox', {name: label}), {
    target: {value},
  });
const openEdit = async (name = '점검') => {
  fireEvent.contextMenu(await screen.findByRole('group', {name}), {
    clientX: 50,
    clientY: 50,
  });
  fireEvent.click(await screen.findByRole('menuitem', {name: '수정…'}));
};

it('puts 수정… above 이름 바꾸기 and opens the timer with its saved values', async () => {
  setup();
  render(<TimerTab />);
  fireEvent.contextMenu(await screen.findByRole('group', {name: '점검'}));
  expect(
    renderedToolMenuRows(screen.getByRole('menu', {name: '타이머'})),
  ).toEqual(['수정…', '|', '이름 바꾸기', '|', '복제', '|', '삭제']);
  fireEvent.click(screen.getByRole('menuitem', {name: '수정…'}));
  const dialog = await screen.findByRole('dialog', {name: '타이머 수정'});
  expect(dialog).toBeTruthy();
  expect(screen.getByRole('textbox', {name: '분'})).toHaveProperty(
    'value',
    '1',
  );
  expect(screen.getByRole('textbox', {name: '초'})).toHaveProperty(
    'value',
    '0',
  );
});

it('saves the new time under the same id and name and leaves other timers alone', async () => {
  const f = setup();
  render(<TimerTab />);
  await openEdit();
  change('분', '2');
  fireEvent.click(screen.getByRole('button', {name: '저장'}));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(f.edit).toHaveBeenCalledOnce();
  expect(written(f)).toEqual([
    {id, name: '점검', kind: 'countdown', duration: 120, overrun: true},
    timers[1],
  ]);
});

it('changes the kind and keeps the id', async () => {
  const f = setup();
  render(<TimerTab />);
  await openEdit();
  fireEvent.click(screen.getByRole('button', {name: '타이머 종류'}));
  fireEvent.click(screen.getByRole('menuitemradio', {name: '시계'}));
  fireEvent.click(screen.getByRole('button', {name: '저장'}));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(f.edit).toHaveBeenCalledOnce();
  expect(written(f)).toEqual([{id, name: '점검', kind: 'clock'}, timers[1]]);
});

it('closes an unchanged save without writing', async () => {
  const f = setup();
  render(<TimerTab />);
  await openEdit();
  fireEvent.click(screen.getByRole('button', {name: '저장'}));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(f.edit).not.toHaveBeenCalled();
});

it('retries once after a stale revision and then reports a refused save', async () => {
  const f = setup();
  const notice = vi.fn();
  f.edit.mockResolvedValue({
    ok: false,
    error: {reason: 'stale', message: 'Stale fixture'},
  });
  render(<TimerTab onProblem={notice} />);
  await openEdit();
  change('분', '3');
  fireEvent.click(screen.getByRole('button', {name: '저장'}));
  await waitFor(() => expect(notice).toHaveBeenCalledOnce());
  expect(f.edit).toHaveBeenCalledTimes(2);
  expect(notice.mock.calls[0]?.[0]).toMatchObject({title: '타이머 변경 실패'});
  expect(screen.getByRole('dialog', {name: '타이머 수정'})).toBeTruthy();
});

it('keeps a paused count and leaves the row enabled while the timer runs', async () => {
  const f = setup();
  f.live({
    timers: {
      [id]: {state: 'paused', at: 100, countedMs: 5000, day: 0, wallAt: 100},
    },
  });
  const before = useLive.getState().state;
  render(<TimerTab />);
  await openEdit();
  change('분', '2');
  fireEvent.click(screen.getByRole('button', {name: '저장'}));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(f.edit).toHaveBeenCalledOnce();
  expect(f.send).not.toHaveBeenCalled();
  expect(useLive.getState().state).toBe(before);
});

it('disables 수정… when the list is read-only', async () => {
  setup(true);
  render(<TimerTab />);
  fireEvent.contextMenu(await screen.findByRole('group', {name: '점검'}));
  const row = screen.getByRole('menuitem', {name: '수정…'});
  expect(row.getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(row);
  expect(screen.queryByRole('dialog')).toBeNull();
});

const quickRow = (api: LlpApi, timer: Timer | undefined) => (
  <QuickRowEditor
    api={api}
    onProblem={vi.fn()}
    full={false}
    timersFull={false}
    item={quickItem('timer')}
    timer={timer}
    locked={false}
    save={vi.fn(async () => true)}
  >
    <button>항목</button>
  </QuickRowEditor>
);

it('opens the timer a 퀵 실행 row refers to and saves it under the same id', async () => {
  const f = setup();
  const timer: Timer = {
    id: createTimerId(id),
    name: '점검',
    kind: 'countdown',
    duration: 60,
  };
  render(quickRow(window.llp ?? mockLlpApi(), timer));
  fireEvent.keyDown(screen.getByRole('button', {name: '항목'}), {
    key: 'F10',
    shiftKey: true,
  });
  expect(
    renderedToolMenuRows(screen.getByRole('menu', {name: '퀵 실행 항목'})),
  ).toEqual(['수정…', '이름 바꾸기', '|', '복제', '|', '삭제']);
  fireEvent.click(screen.getByRole('menuitem', {name: '수정…'}));
  await screen.findByRole('dialog', {name: '타이머 수정'});
  fireEvent.click(screen.getByRole('button', {name: '타이머 종류'}));
  fireEvent.click(screen.getByRole('menuitemradio', {name: '경과'}));
  fireEvent.click(screen.getByRole('button', {name: '저장'}));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(f.edit).toHaveBeenCalledOnce();
  expect(written(f)).toEqual([
    {id, name: '점검', kind: 'elapsed', start: 60},
    timers[1],
  ]);
});

it('says why a 퀵 실행 timer row cannot be edited when its timer is missing', () => {
  setup();
  render(quickRow(window.llp ?? mockLlpApi(), undefined));
  fireEvent.keyDown(screen.getByRole('button', {name: '항목'}), {
    key: 'F10',
    shiftKey: true,
  });
  const row = screen.getByRole('menuitem', {name: '수정…'});
  expect(row.getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(row);
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('opens a new timer at 5분, a valid default', async () => {
  const f = setup();
  render(<TimerTab />);
  fireEvent.click(await screen.findByRole('button', {name: '타이머 추가'}));
  expect(screen.getByRole('textbox', {name: '분'})).toHaveProperty(
    'value',
    '5',
  );
  expect(screen.getByRole('textbox', {name: '초'})).toHaveProperty(
    'value',
    '0',
  );
  expect(
    screen.getByRole('textbox', {name: '분'}).getAttribute('aria-invalid'),
  ).not.toBe('true');
  fireEvent.click(screen.getByRole('button', {name: '추가'}));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(f.edit).toHaveBeenCalledOnce();
});

it('starts a new 경과 timer from 0 when nothing was typed', async () => {
  setup();
  render(<TimerTab />);
  fireEvent.click(await screen.findByRole('button', {name: '타이머 추가'}));
  fireEvent.click(screen.getByRole('button', {name: '타이머 종류'}));
  fireEvent.click(screen.getByRole('menuitemradio', {name: '경과'}));
  expect(screen.getByRole('textbox', {name: '분'})).toHaveProperty(
    'value',
    '0',
  );
});
