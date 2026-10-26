import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {LlpApi} from '@shared/ipc';
import type {EditResult} from '@shared/schema/contentEdit';
import {
  parseSettingsDocument,
  type SettingsDocument,
} from '@shared/schema/settingsDocuments';
import {expectSuccess} from '@shared/schema/testHelpers';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {emptyLiveState} from '@shared/live';
import {useLive} from '@renderer/state/live';
import {pendingWritesOf} from '@renderer/state/pendingWrites';
import type {Notice} from '@renderer/ui/notices';
import {QuickPanel} from './QuickPanel';
import {deferred, quickFixture, quickId} from './quickTesting';

function documents({
  separate = false,
  readOnly = false,
  missing = false,
  clock = false,
} = {}) {
  const quick = expectSuccess(
    parseSettingsDocument({
      name: 'quick',
      revision: separate ? 2 : 1,
      access: readOnly ? 'readOnly' : 'editable',
      value: {
        format: 'llsettings.quick',
        schemaVersion: 1,
        items: (clock ? [1] : [1, 2]).map(n => ({
          id: quickId(n),
          kind: 'timer',
          name: n === 1 ? '첫 타이머' : '둘째 타이머',
          ref: quickId(separate && n === 2 ? 105 : 104),
        })),
      },
    }),
  );
  const timers = expectSuccess(
    parseSettingsDocument({
      name: 'timers',
      revision: separate ? 2 : 1,
      access: readOnly ? 'readOnly' : 'editable',
      value: {
        format: 'llsettings.timers',
        schemaVersion: 1,
        timers: missing
          ? []
          : (separate ? [104, 105] : [104]).map(n => ({
              id: quickId(n),
              name: '설정',
              ...(clock ? {kind: 'clock'} : {kind: 'countdown', duration: 2}),
            })),
      },
    }),
  );
  return {quick, timers};
}

function setup(options: Parameters<typeof documents>[0] = {}) {
  const base = quickFixture();
  let current = documents(options);
  const listeners = new Set<(document: SettingsDocument) => void>();
  const pending = deferred<EditResult>();
  const edit = vi.fn<LlpApi['settings']['edit']>(() => pending.promise);
  const api = fakeLlpApi({
    ...base.api,
    settings: {
      ...base.api.settings,
      get: request =>
        request.name === 'quick'
          ? Promise.resolve(current.quick)
          : request.name === 'timers'
            ? Promise.resolve(current.timers)
            : base.get(request),
      edit,
      subscribe: listener => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    },
  });
  window.llp = api;
  const problem = vi.fn<(notice: Notice) => void>();
  return {
    ...base,
    api,
    edit,
    pending,
    listeners,
    problem,
    mount: () =>
      render(<QuickPanel selectionVersion={0} onProblem={problem} />),
    separate: () => {
      current = documents({separate: true});
      for (const document of [current.timers, current.quick]) {
        for (const listener of listeners) listener(document);
      }
    },
  };
}

beforeEach(() => {
  useLive.setState({state: emptyLiveState()});
});
afterEach(() => {
  cleanup();
  delete window.llp;
});

describe('quick timer isolation', () => {
  it('blocks a shared secondary row during separation and keeps the accepted operation in the close gate', async () => {
    const f = setup();
    const view = f.mount();
    const second = await screen.findByRole('button', {name: /^둘째 타이머/});
    await waitFor(() =>
      expect(f.edit).toHaveBeenCalledExactlyOnceWith({
        type: 'quick.timers.separate',
        name: 'quick',
      }),
    );
    expect(second.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(second);
    expect(f.send).not.toHaveBeenCalled();
    let finished = false;
    const closing = pendingWritesOf(f.api)
      .flush()
      .then(result => {
        finished = true;
        return result;
      });
    await act(async () => undefined);
    expect(finished).toBe(false);
    await act(async () => {
      f.separate();
      f.pending.resolve({ok: true, value: {id: 'quick', revision: 2}});
    });
    expect(await closing).toBe(true);
    await waitFor(() =>
      expect(second.getAttribute('aria-disabled')).toBeNull(),
    );
    fireEvent.click(second);
    expect(f.send).toHaveBeenCalledExactlyOnceWith({
      type: 'timer.start',
      timerId: quickId(105),
    });
    view.unmount();
    expect(f.listeners.size).toBe(0);
  });

  it('catches synchronous failures, stops retrying that revision and resolves its warning after an explicit retry', async () => {
    const f = setup();
    f.edit.mockImplementation(() => {
      throw new Error('Invented separation failure');
    });
    f.mount();
    await waitFor(() => expect(f.problem).toHaveBeenCalledOnce());
    expect(f.edit).toHaveBeenCalledOnce();
    const retry = f.problem.mock.calls[0]?.[0].actions?.[0];
    if (!retry) throw new Error('Missing retry action');
    act(retry.onSelect);
    await waitFor(() => expect(f.problem).toHaveBeenCalledTimes(2));
    expect(f.edit).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', {name: /^둘째 타이머/}));
    expect(f.send).not.toHaveBeenCalled();
    f.edit.mockImplementation(() => f.pending.promise);
    const again = f.problem.mock.calls[1]?.[0].actions?.[0];
    if (!again) throw new Error('Missing second retry action');
    act(again.onSelect);
    await waitFor(() => expect(f.edit).toHaveBeenCalledTimes(3));
    await act(async () => {
      f.separate();
      f.pending.resolve({ok: true, value: {id: 'quick', revision: 2}});
    });
    await waitFor(() =>
      expect(f.problem).toHaveBeenLastCalledWith(
        expect.objectContaining({key: 'quick:timer-separation', kind: 'info'}),
      ),
    );
  });

  it('keeps read-only shared rows and missing definitions from starting', async () => {
    const f = setup({readOnly: true});
    const view = f.mount();
    const second = await screen.findByRole('button', {name: /^둘째 타이머/});
    fireEvent.click(second);
    expect(f.send).not.toHaveBeenCalled();
    expect(f.edit).not.toHaveBeenCalled();
    view.unmount();
    const missing = setup({missing: true});
    missing.mount();
    fireEvent.click(await screen.findByRole('button', {name: /^첫 타이머/}));
    expect(missing.send).not.toHaveBeenCalled();
    expect(missing.edit).not.toHaveBeenCalled();
  });

  it('shows a legacy clock without offering a start or reset action', async () => {
    const f = setup({clock: true});
    f.mount();
    const row = await screen.findByRole('button', {name: /^첫 타이머/});
    await waitFor(() => expect(row.textContent).toMatch(/\d{2}:\d{2}:\d{2}/));
    expect(row.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(row);
    expect(f.send).not.toHaveBeenCalled();
  });
});
