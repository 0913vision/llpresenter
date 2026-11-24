import {settingsDocument} from '@fixtures/core/settingsDocument';
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
import type {EditResult} from '@core/schema/services/contentEdit';
import {deferred} from '@fixtures/renderer/features/tools/quickTesting';
import {stageFixture} from '@fixtures/renderer/features/tools/stageTesting';
import {TimerTab} from '@renderer/features/tools/timers/TimerTab';

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
}

it('deletes immediately and routes undo to the shared settings history', async () => {
  const f = setup();
  f.edit.mockResolvedValue({ok: true, value: {id, revision: 2}});
  render(
    <div data-workspace-layout="show">
      <div data-show-slide-grid>
        <div role="listbox" aria-label="슬라이드" tabIndex={-1} />
      </div>
      <TimerTab />
    </div>,
  );
  await openRemoval();
  await waitFor(() => expect(f.edit).toHaveBeenCalledOnce());
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(
    document.activeElement?.contains(
      screen.getByRole('list', {name: '타이머 목록'}),
    ),
  ).toBe(true);
  expect(
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: 'ArrowRight',
      code: 'ArrowRight',
    }),
  ).toBe(true);
  fireEvent.keyDown(document.activeElement ?? document.body, {
    key: 'z',
    code: 'KeyZ',
    ctrlKey: true,
  });
  await waitFor(() =>
    expect(f.edit).toHaveBeenCalledWith({
      type: 'settings.undoDelete',
      name: 'delete-history',
      area: 'timers',
      expectedRevision: 2,
    }),
  );
});

it('reports persistence failure after the row unmounts without stealing later focus', async () => {
  const f = setup();
  const reply = deferred<EditResult>();
  const notice = vi.fn();
  f.edit.mockImplementation(edit => {
    if (edit.type !== 'timer.delete') throw Error('Unexpected edit');
    f.push(settingsDocument('timers', {timers: [other]}, 2));
    return reply.promise;
  });
  render(<TimerTab onProblem={notice} />);
  await openRemoval();
  await waitFor(() =>
    expect(screen.queryByRole('group', {name: '첫 타이머'})).toBeNull(),
  );
  expect(screen.queryByRole('alertdialog')).toBeNull();
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
});

it('reports refusal and blocks a read-only deletion', async () => {
  const f = setup();
  const notice = vi.fn();
  f.edit.mockResolvedValue({
    ok: false,
    error: {reason: 'read-only', message: 'Fixture access'},
  });
  render(<TimerTab onProblem={notice} />);
  await openRemoval();
  await waitFor(() =>
    expect(notice).toHaveBeenCalledWith(
      expect.objectContaining({title: '타이머 변경 실패'}),
    ),
  );
  expect(screen.queryByRole('alertdialog')).toBeNull();
  act(() =>
    f.push({
      ...settingsDocument('timers', {timers: [timer, other]}, 2),
      access: 'readOnly',
    }),
  );
  const row = await screen.findByRole('group', {name: '첫 타이머'});
  fireEvent.contextMenu(row);
  expect(
    (await screen.findByRole('menuitem', {name: '삭제'})).getAttribute(
      'aria-disabled',
    ),
  ).toBe('true');
  fireEvent.click(screen.getByRole('menuitem', {name: '삭제'}));
  expect(f.edit).toHaveBeenCalledTimes(1);
});

it('lets the operator run another timer while a deletion is pending', async () => {
  const f = setup();
  const reply = deferred<EditResult>();
  const notice = vi.fn();
  f.edit.mockReturnValue(reply.promise);
  render(<TimerTab onProblem={notice} />);
  await openRemoval();
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
