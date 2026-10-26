import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@shared/live';
import type {MonitorList} from '@shared/schema/monitors';
import type {OutputStatuses} from '@shared/schema/outputStatus';
import type {SettingsDocument} from '@shared/schema/settingsDocuments';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {createMemoryColumnWidthStore} from '@renderer/shell/columnWidthStore';
import {Workspace} from '@renderer/shell/Workspace';
import {useLive} from '@renderer/state/live';
import {hoverForTooltip, resetTooltips} from '@renderer/ui/tooltipTesting';
import {useScreensSelection} from './selection';
import {
  CAPTIONS_ID,
  MAIN_ID,
  looksDocument,
  screensDocument,
  settingsDocument,
  stageLayoutsDocument,
} from './testing/documents';

vi.mock('@renderer/render/outputRenderer', () => ({
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
    case 'looks':
      return Promise.resolve(looksDocument());
    case 'stage-layouts':
      return Promise.resolve(stageLayoutsDocument());
    default:
      return Promise.reject(new Error(`Unexpected settings read: ${name}`));
  }
}

function setup({
  statuses = {},
  outputs = {[MAIN_ID]: true},
  read = readDocument,
  monitors = [],
}: {
  readonly statuses?: OutputStatuses;
  readonly outputs?: Readonly<Record<string, boolean>>;
  readonly read?: (name: string) => Promise<SettingsDocument>;
  readonly monitors?: MonitorList;
} = {}) {
  const settingsListeners = new Set<(document: SettingsDocument) => void>();
  let pushStatus: (next: OutputStatuses) => void = () => undefined;
  const stopStatus = vi.fn();
  const onProblem = vi.fn();
  window.llp = fakeLlpApi({
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
    <Workspace
      id="screens"
      sizeClass="normal"
      store={createMemoryColumnWidthStore()}
      onProblem={onProblem}
    />,
  );
  return {
    view,
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
  useScreensSelection.setState({selection: {kind: 'screen', id: null}});
});

afterEach(() => {
  cleanup();
  useLive.setState({state: null});
  delete window.llp;
  resetTooltips();
});

function option(name: string): HTMLElement {
  return screen.getByRole('option', {name});
}

function selectedOf(name: string): string | null {
  return option(name).getAttribute('aria-selected');
}

describe('the 화면 list', () => {
  it('stacks 화면, Look, and 무대 배치 in the left column', async () => {
    setup();
    await screen.findByRole('option', {name: '본 화면'});
    const labels = screen
      .getAllByRole('listbox')
      .map(list => list.getAttribute('aria-label'));
    expect(labels).toEqual(['화면', 'Look', '무대 배치']);
  });

  it('mounts the display layout in the center column', async () => {
    setup();

    expect(
      await screen.findByRole('button', {name: '모니터 번호 표시'}),
    ).toBeTruthy();
  });

  it('groups the screens under 청중 and 무대 with their targets', async () => {
    setup();
    await screen.findByRole('option', {name: '본 화면'});
    const groups = within(
      screen.getByRole('listbox', {name: '화면'}),
    ).getAllByRole('group');
    expect(groups.map(group => group.textContent)).toEqual([
      '청중본 화면모니터 2방송 자막캡처용 창',
      '무대무대 화면모니터 미지정',
    ]);
  });

  it('selects the first screen until another row is chosen', async () => {
    setup();
    await screen.findByRole('option', {name: '본 화면'});
    expect(selectedOf('본 화면')).toBe('true');
    await userEvent.setup().click(option('방송 자막'));
    expect(useScreensSelection.getState().selection).toEqual({
      kind: 'screen',
      id: CAPTIONS_ID,
    });
    expect(selectedOf('본 화면')).toBe('false');
    expect(selectedOf('방송 자막')).toBe('true');
  });

  it('shows the ok dot for a healthy output and none for an output that is off', async () => {
    setup({statuses: {[MAIN_ID]: running}});
    await screen.findByRole('option', {name: '본 화면'});
    await waitFor(() =>
      expect(
        option('본 화면').querySelector('[data-tone="ok"]'),
      ).not.toBeNull(),
    );
    expect(option('방송 자막').querySelector('[data-tone]')).toBeNull();
  });

  it('shows the amber dot with the reason in a tooltip', async () => {
    setup({statuses: {[MAIN_ID]: {...running, placement: 'monitorMissing'}}});
    await screen.findByRole('option', {name: '본 화면'});
    await waitFor(() =>
      expect(
        option('본 화면').querySelector('[data-tone="warning"]'),
      ).not.toBeNull(),
    );
    const tooltip = await hoverForTooltip(option('본 화면'));
    expect(tooltip?.textContent).toBe('모니터를 찾을 수 없음');
  });

  it('follows a status push', async () => {
    const {pushStatus} = setup();
    await screen.findByRole('option', {name: '본 화면'});
    pushStatus({[MAIN_ID]: {...running, fpsLow: true}});
    expect(
      option('본 화면').querySelector('[data-tone="warning"]'),
    ).not.toBeNull();
  });

  it('keeps a newer settings push over an older one', async () => {
    const {pushSettings} = setup();
    await screen.findByRole('option', {name: '본 화면'});
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
    await screen.findByRole('option', {name: '본 화면'});
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

describe('the Look and 무대 배치 lists', () => {
  it('marks the Look and the stage layout in use with the LIVE badge', async () => {
    setup();
    await screen.findByRole('option', {name: '평상시'});
    await waitFor(() =>
      expect(option('현재와 다음').textContent).toContain('LIVE'),
    );
    expect(option('평상시').textContent).toContain('LIVE');
    expect(option('설교').textContent).not.toContain('LIVE');
    expect(option('하단 자막').textContent).not.toContain('LIVE');
  });

  it('moves the marks with the Look selected on output', async () => {
    setup();
    await screen.findByRole('option', {name: '평상시'});
    await waitFor(() =>
      expect(option('현재와 다음').textContent).toContain('LIVE'),
    );
    const sermon = await readDocument('looks');
    if (sermon.name !== 'looks') throw new Error('Expected looks');
    act(() =>
      useLive.setState({
        state: {...emptyLiveState(), lookId: sermon.value.looks[1]?.id ?? null},
      }),
    );
    expect(option('설교').textContent).toContain('LIVE');
    expect(option('하단 자막').textContent).toContain('LIVE');
    expect(option('평상시').textContent).not.toContain('LIVE');
    expect(option('현재와 다음').textContent).not.toContain('LIVE');
  });

  it('marks the first screen and its monitor before any pick, and follows the fallback after a removal', async () => {
    const projector = {
      id: 2,
      number: 2,
      name: 'Projector',
      bounds: {x: 1920, y: 0, width: 1920, height: 1080},
      scaleFactor: 1,
      refreshRate: 60,
      hasMainWindow: false,
    };
    const control = {...projector, id: 1, number: 1, hasMainWindow: true};
    const {pushSettings} = setup({
      monitors: [{...control, bounds: {...control.bounds, x: 0}}, projector],
    });
    await screen.findByRole('option', {name: '본 화면'});
    const box = (number: number) =>
      document.querySelector(`[data-monitor="${number}"]`);
    await waitFor(() => expect(box(2)?.textContent).toContain('본 화면'));
    expect(selectedOf('본 화면')).toBe('true');
    expect(box(2)?.getAttribute('aria-current')).toBe('true');

    const without = screensDocument(2);
    if (without.name !== 'screens') throw new Error('Expected screens');
    pushSettings(
      settingsDocument(
        'screens',
        {screens: without.value.screens.filter(({id}) => id !== MAIN_ID)},
        2,
      ),
    );

    await waitFor(() => expect(selectedOf('방송 자막')).toBe('true'));
    expect(box(2)?.getAttribute('aria-current')).toBeNull();
    expect(
      document
        .querySelector(`[data-target="${CAPTIONS_ID}"]`)
        ?.getAttribute('aria-current'),
    ).toBe('true');
  });

  it('keeps one selection across the three lists', async () => {
    setup();
    await screen.findByRole('option', {name: '본 화면'});
    await userEvent.setup().click(option('설교'));
    expect(useScreensSelection.getState().selection.kind).toBe('look');
    expect(selectedOf('설교')).toBe('true');
    expect(selectedOf('본 화면')).toBe('false');
  });
});
