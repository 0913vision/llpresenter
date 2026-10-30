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
import type {EditResult} from '@core/schema/contentEdit';
import {settingsDocument} from '@renderer/screens/testing/documents';
import {deferred} from '../quick/quickTesting';
import {stageFixture} from './stageTesting';
import {TimerTab} from './TimerTab';

const id = '00000000-0000-4000-8000-000000000001';
const otherId = '00000000-0000-4000-8000-000000000002';
const timer = {id, name: '첫 타이머', kind: 'countdown', duration: 90};
const other = {...timer, id: otherId, name: '둘째 타이머'};

afterEach(() => {
  cleanup();
  delete window.llp;
  vi.restoreAllMocks();
});

function setup() {
  const f = stageFixture();
  f.documents.set(
    'timers',
    settingsDocument('timers', {timers: [timer, other]}),
  );
  return f;
}

async function openRemoval() {
  const row = await screen.findByRole('group', {name: '첫 타이머'});
  fireEvent.contextMenu(row, {clientX: 50, clientY: 50});
  fireEvent.click(await screen.findByRole('menuitem', {name: '삭제'}));
  return screen.getByRole('alertdialog');
}

it('asks before deleting and cancels without sending an edit', async () => {
  const f = setup();
  render(<TimerTab />);
  const dialog = await openRemoval();
  expect(dialog.textContent).toContain('연결된 퀵 실행 항목도 삭제');
  fireEvent.click(within(dialog).getByRole('button', {name: '취소'}));
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(f.edit).not.toHaveBeenCalled();
});

it('keeps the confirmation and persistence warning alive after the row unmounts', async () => {
  const f = setup();
  const reply = deferred<EditResult>();
  const notice = vi.fn();
  f.edit.mockImplementation(edit => {
    if (edit.type !== 'timer.delete') throw Error('Unexpected edit');
    f.push(settingsDocument('timers', {timers: [other]}, 2));
    return reply.promise;
  });
  render(<TimerTab onProblem={notice} />);
  const dialog = await openRemoval();
  fireEvent.click(within(dialog).getByRole('button', {name: '삭제'}));
  await waitFor(() =>
    expect(screen.queryByRole('group', {name: '첫 타이머'})).toBeNull(),
  );
  expect(screen.getByRole('alertdialog')).toBeDefined();
  expect(f.edit).toHaveBeenCalledExactlyOnceWith({
    type: 'timer.delete',
    name: 'timers',
    timerId: id,
  });
  fireEvent.click(
    within(screen.getByRole('group', {name: '둘째 타이머'})).getByRole(
      'button',
      {name: '시작'},
    ),
  );
  expect(f.send).toHaveBeenCalledWith({type: 'timer.start', timerId: otherId});
  await act(async () =>
    reply.resolve({
      ok: false,
      error: {
        reason: 'write-failed',
        message: 'Fixture disk',
        applied: {id, revision: 2},
        unchangedFiles: ['timers.json'],
      },
    }),
  );
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  expect(notice).toHaveBeenCalledWith(
    expect.objectContaining({title: '타이머 저장 실패'}),
  );
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole('list', {name: '타이머 목록'}),
    ),
  );
});

it('keeps the confirmation open after refusal and blocks a read-only change', async () => {
  const f = setup();
  const notice = vi.fn();
  f.edit.mockResolvedValue({
    ok: false,
    error: {reason: 'read-only', message: 'Fixture access'},
  });
  render(<TimerTab onProblem={notice} />);
  const dialog = await openRemoval();
  fireEvent.click(within(dialog).getByRole('button', {name: '삭제'}));
  await waitFor(() =>
    expect(notice).toHaveBeenCalledWith(
      expect.objectContaining({title: '타이머 변경 실패'}),
    ),
  );
  expect(screen.getByRole('alertdialog')).toBeDefined();
  act(() =>
    f.push({
      ...settingsDocument('timers', {timers: [timer, other]}, 2),
      access: 'readOnly',
    }),
  );
  expect(
    within(dialog)
      .getByRole('button', {name: '삭제'})
      .getAttribute('aria-disabled'),
  ).toBe('true');
  fireEvent.click(within(dialog).getByRole('button', {name: '삭제'}));
  expect(f.edit).toHaveBeenCalledTimes(1);
});

it('lets the operator dismiss a pending deletion and continue running another timer', async () => {
  const f = setup();
  const reply = deferred<EditResult>();
  const notice = vi.fn();
  f.edit.mockReturnValue(reply.promise);
  render(<TimerTab onProblem={notice} />);
  const dialog = await openRemoval();
  fireEvent.click(within(dialog).getByRole('button', {name: '삭제'}));
  fireEvent.click(within(dialog).getByRole('button', {name: '닫기'}));
  expect(screen.queryByRole('alertdialog')).toBeNull();
  const start = within(
    screen.getByRole('group', {name: '둘째 타이머'}),
  ).getByRole('button', {name: '시작'});
  start.focus();
  fireEvent.click(start);
  expect(f.send).toHaveBeenCalledWith({type: 'timer.start', timerId: otherId});
  await act(async () =>
    reply.resolve({
      ok: false,
      error: {
        reason: 'write-failed',
        message: 'Fixture disk',
        applied: {id, revision: 2},
        unchangedFiles: ['timers.json'],
      },
    }),
  );
  expect(notice).toHaveBeenCalledWith(
    expect.objectContaining({title: '타이머 저장 실패'}),
  );
  expect(document.activeElement).toBe(start);
});
