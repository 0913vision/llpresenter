import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {LlpApi} from '@contracts/ipc/api';
import type {EditResult} from '@core/schema/contentEdit';
import {
  parseSettingsDocument,
  type SettingsDocument,
} from '@core/schema/settingsDocuments';
import {expectSuccess} from '@fixtures/core/schema/testHelpers';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {emptyLiveState} from '@core/live/state';
import {useLive} from '@renderer/session/live';
import type {Notice} from '@renderer/ui/notices';
import {QuickPanel} from '@renderer/features/quick/QuickPanel';
import {
  deferred,
  quickFixture,
  quickId,
} from '@fixtures/renderer/features/tools/quickTesting';

function documents({missing = false, clock = false, none = false} = {}) {
  const quick = expectSuccess(
    parseSettingsDocument({
      name: 'quick',
      revision: 1,
      access: 'editable',
      value: {
        format: 'llsettings.quick',
        schemaVersion: 1,
        items: (none ? [] : [1]).map(n => ({
          id: quickId(n),
          kind: 'timer',
          name: '첫 타이머',
          ref: quickId(104),
        })),
      },
    }),
  );
  const timers = expectSuccess(
    parseSettingsDocument({
      name: 'timers',
      revision: 1,
      access: 'editable',
      value: {
        format: 'llsettings.timers',
        schemaVersion: 1,
        timers: missing
          ? []
          : [
              {
                id: quickId(104),
                name: '설정',
                ...(clock ? {kind: 'clock'} : {kind: 'countdown', duration: 2}),
              },
            ],
      },
    }),
  );
  return {quick, timers};
}

function setup(options: Parameters<typeof documents>[0] = {}) {
  const base = quickFixture();
  const current = documents(options);
  const listeners = new Set<(document: SettingsDocument) => void>();
  const pending = deferred<EditResult>();
  const edit = vi.fn<LlpApi['settings']['edit']>(() => pending.promise);
  const api = mockLlpApi({
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
  };
}

beforeEach(() => {
  useLive.setState({state: emptyLiveState()});
});
afterEach(() => {
  cleanup();
  delete window.llp;
});

describe('quick timers', () => {
  it('does not read timer settings when the quick list has no timer rows', async () => {
    const f = setup({none: true});
    const get = vi.spyOn(f.api.settings, 'get');
    f.mount();
    await waitFor(() =>
      expect(
        screen
          .getByRole('button', {name: '퀵 실행 추가'})
          .getAttribute('aria-disabled'),
      ).not.toBe('true'),
    );
    expect(get).not.toHaveBeenCalledWith({name: 'timers'});
    expect(f.problem).not.toHaveBeenCalled();
  });

  it('keeps a row without a definition from starting and writes nothing', async () => {
    const f = setup({missing: true});
    f.mount();
    fireEvent.click(await screen.findByRole('button', {name: /^첫 타이머/}));
    expect(f.send).not.toHaveBeenCalled();
    expect(f.edit).not.toHaveBeenCalled();
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
