import {settingsDocument} from '@fixtures/core/settingsDocument';
import {act, cleanup, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import {createDefaultThemes} from '@core/themes/defaults';
import type {LiveCommand} from '@core/live/commands';
import type {MonitorList} from '@core/schema/monitors';
import type {OutputStatuses} from '@core/schema/outputStatus';
import type {SettingsDocument} from '@core/schema/settingsDocuments';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {DisplayLayout} from '@renderer/features/screens/DisplayLayout';
import {ScreenList} from '@renderer/features/screens/ScreenList';
import {useLive} from '@renderer/session/live';
import {
  hoverForTooltip,
  resetTooltips,
} from '@fixtures/renderer/ui/tooltipTesting';
import {useScreensSelection} from '@renderer/features/screens/selection';
import {wideMonitorArrangement} from '@fixtures/renderer/features/screens/monitorArrangement';
import {
  CAPTIONS_ID,
  MAIN_ID,
  screensDocument,
} from '@fixtures/core/screenDocuments';

vi.mock('@renderer/rendering/outputRenderer', () => ({
  OutputRenderer: class {
    render = vi.fn();
    dispose = vi.fn();
  },
}));

const running = {
  placement: 'fullscreen',
  renderer: 'running',
  fps: 60,
  fpsLow: false,
} as const;

function readDocument(name: string): Promise<SettingsDocument> {
  switch (name) {
    case 'screens':
      return Promise.resolve(screensDocument());
    case 'themes':
      return Promise.resolve(settingsDocument('themes', createDefaultThemes()));
    case 'macros':
      return Promise.resolve(
        settingsDocument('macros', {macros: [], collections: []}),
      );
    case 'timers':
      return Promise.resolve(settingsDocument('timers', {timers: []}));
    default:
      return Promise.reject(new Error(`Unexpected settings read: ${name}`));
  }
}

function setup({
  statuses = {},
  outputs = {[MAIN_ID]: true},
  read = readDocument,
  monitors = [],
  layout = false,
}: {
  readonly statuses?: OutputStatuses;
  readonly outputs?: Readonly<Record<string, boolean>>;
  readonly read?: (name: string) => Promise<SettingsDocument>;
  readonly monitors?: MonitorList;
  readonly layout?: boolean;
} = {}) {
  const settingsListeners = new Set<(document: SettingsDocument) => void>();
  let pushStatus: (next: OutputStatuses) => void = () => undefined;
  const stopStatus = vi.fn();
  const onProblem = vi.fn();
  const send = vi.fn<(command: LiveCommand) => void>();
  window.llp = mockLlpApi({
    live: {send, clock: () => Promise.resolve(1000)},
    settings: {
      get: request => read(request.name),
      subscribe: listener => {
        settingsListeners.add(listener);
        return () => {
          settingsListeners.delete(listener);
        };
      },
    },
    monitors: {get: () => Promise.resolve(monitors)},
    output: {
      getStatus: () => Promise.resolve(statuses),
      subscribeStatus: listener => {
        pushStatus = listener;
        return stopStatus;
      },
    },
  });
  useLive.setState({state: {...emptyLiveState(), outputs}});
  const view = render(
    layout ? (
      <DisplayLayout onProblem={onProblem} />
    ) : (
      <ScreenList onProblem={onProblem} />
    ),
  );
  return {
    view,
    send,
    onProblem,
    stopStatus,
    listenerCount: () => settingsListeners.size,
    pushSettings: (document: SettingsDocument) => {
      act(() => {
        for (const listener of settingsListeners) listener(document);
      });
    },
    pushStatus: (next: OutputStatuses) => act(() => pushStatus(next)),
  };
}

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  useScreensSelection.setState({selection: {id: null}});
});

afterEach(() => {
  cleanup();
  useLive.setState({state: null});
  delete window.llp;
  resetTooltips();
  vi.unstubAllGlobals();
});

function option(name: string): HTMLElement {
  return screen.getByRole('option', {name});
}

function selectedOf(name: string): string | null {
  return option(name).getAttribute('aria-selected');
}

describe('the 화면 list', () => {
  it('keeps the configured monitor selected and named while output is off', async () => {
    const {send} = setup({
      outputs: {},
      monitors: wideMonitorArrangement,
      layout: true,
    });
    const monitor = await screen.findByRole('button', {
      name: '모니터 2 Second monitor',
    });
    await waitFor(() =>
      expect(monitor.getAttribute('aria-pressed')).toBe('true'),
    );
    expect(monitor.textContent).toContain('청중 화면');
    expect(document.querySelector(`[data-target="${MAIN_ID}"]`)).toBeNull();
    act(() =>
      useLive.setState({
        state: {...emptyLiveState(), outputs: {[MAIN_ID]: true}},
      }),
    );
    act(() =>
      useLive.setState({
        state: {...emptyLiveState(), outputs: {[MAIN_ID]: false}},
      }),
    );
    expect(monitor.getAttribute('aria-pressed')).toBe('true');
    expect(monitor.textContent).toContain('청중 화면');
    act(() => useScreensSelection.setState({selection: {id: CAPTIONS_ID}}));
    expect(monitor.getAttribute('aria-pressed')).toBe('false');
    await userEvent.click(monitor);
    expect(useScreensSelection.getState().selection).toEqual({id: MAIN_ID});
    expect(send).not.toHaveBeenCalled();
  });

  it('selects the first screen until another row is chosen', async () => {
    setup();
    await screen.findByRole('option', {name: '청중 화면', selected: true});
    await userEvent.setup().click(option('방송 화면'));
    await screen.findByRole('option', {name: '방송 화면', selected: true});
    expect(useScreensSelection.getState().selection).toEqual({id: CAPTIONS_ID});
    expect(selectedOf('청중 화면')).toBe('false');
    expect(selectedOf('방송 화면')).toBe('true');
  });

  it('selects the first screen after a delayed settings read', async () => {
    let resolveScreens: ((value: SettingsDocument) => void) | undefined;
    const pending = new Promise<SettingsDocument>(resolve => {
      resolveScreens = resolve;
    });
    setup({
      read: name => (name === 'screens' ? pending : readDocument(name)),
    });
    expect(screen.queryByRole('option', {name: '청중 화면'})).toBeNull();

    if (resolveScreens === undefined) throw new Error('Missing resolver');
    resolveScreens(screensDocument());

    await screen.findByRole('option', {name: '청중 화면', selected: true});
    expect(selectedOf('방송 화면')).toBe('false');
    expect(useScreensSelection.getState().selection).toEqual({id: null});
  });

  it('shows the amber dot with the reason in a tooltip', async () => {
    setup({statuses: {[MAIN_ID]: {...running, placement: 'monitorMissing'}}});
    await screen.findByRole('option', {name: '청중 화면'});
    await waitFor(() =>
      expect(
        option('청중 화면').querySelector('[data-tone="warning"]'),
      ).not.toBeNull(),
    );
    const tooltip = await hoverForTooltip(option('청중 화면'));
    expect(tooltip?.textContent).toBe('모니터를 찾을 수 없습니다');
  });

  it('follows a status push', async () => {
    const {pushStatus} = setup();
    await screen.findByRole('option', {name: '청중 화면'});
    pushStatus({[MAIN_ID]: {...running, fpsLow: true}});
    expect(
      option('청중 화면').querySelector('[data-tone="warning"]'),
    ).not.toBeNull();
  });

  it('keeps a newer settings push over an older one', async () => {
    const {pushSettings} = setup();
    await screen.findByRole('option', {name: '청중 화면'});
    const only = (revision: number, name: string) =>
      settingsDocument(
        'screens',
        {
          screens: [
            {
              id: MAIN_ID,
              name,
              kind: 'audience',
              method: 'window',
            },
          ],
        },
        revision,
      );
    pushSettings(only(3, '새 이름'));
    expect(screen.getAllByRole('option', {name: /새 이름/})).toHaveLength(1);
    pushSettings(only(2, '옛 이름'));
    expect(screen.queryByRole('option', {name: '옛 이름'})).toBeNull();
    expect(option('새 이름').textContent).toContain('창');
  });

  it('releases its subscriptions on unmount', async () => {
    const {view, stopStatus, listenerCount} = setup();
    await screen.findByRole('option', {name: '청중 화면'});
    expect(listenerCount()).toBeGreaterThan(0);
    view.unmount();
    expect(stopStatus).toHaveBeenCalledOnce();
    expect(listenerCount()).toBe(0);
  });

  it('reports a failed read and keeps the list empty', async () => {
    const {onProblem} = setup({
      read: () => Promise.reject(new Error('disk')),
    });
    await waitFor(() =>
      expect(onProblem).toHaveBeenCalledWith(
        expect.objectContaining({key: 'screens:load:screens'}),
      ),
    );
    expect(screen.queryByRole('option')).toBeNull();
  });
});
