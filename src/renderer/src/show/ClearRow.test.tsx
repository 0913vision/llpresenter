import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi,
} from 'vitest';
import type {LiveCommand} from '@core/live/commands';
import type {LlpApi} from '@contracts/ipc/api';
import {defaultPreferences} from '@core/schema/preferences';
import {emptyLayers, emptyLiveState, type LiveLayers} from '@core/live/state';
import {fakeLlpApi} from '@contracts/ipc/testing/fakeLlpApi';
import {startLiveSync, useLive} from '@renderer/state/live';
import {hoverForTooltip, resetTooltips} from '@renderer/ui/tooltipTesting';
import {hasSomethingToClear} from './clear';
import {ClearRow} from './ClearRow';

const iconRenders = vi.hoisted(() => {
  const names: string[] = [];
  return {names};
});

vi.mock('@renderer/ui/Icon', () => ({
  Icon: ({name}: {readonly name: string}) => {
    iconRenders.names.push(name);
    return null;
  },
}));

const sent: LiveCommand[] = [];

function installApi(showClearUndoButton?: boolean): LlpApi {
  const api = fakeLlpApi({
    live: {
      get: async () => emptyLiveState(),
      send: command => sent.push(command),
      subscribe: () => () => undefined,
    },
    preferences:
      showClearUndoButton === undefined
        ? {}
        : {
            get: async () => ({
              ...defaultPreferences,
              show: {showClearUndoButton},
            }),
          },
  });
  window.llp = api;
  return api;
}

async function renderWithUndo(compact = false) {
  const api = installApi(true);
  const firstState = emptyLiveState();
  const firstRead = Promise.resolve(firstState);
  vi.spyOn(api.live, 'get').mockReturnValue(firstRead);
  const result = render(<ClearRow compact={compact} />);
  onTestFinished(startLiveSync());
  await act(async () => {
    await firstRead;
  });
  expect(useLive.getState().state).toBe(firstState);
  await screen.findByRole('button', {name: '되돌리기'});
  return result;
}

function setCanUndo(canUndo: boolean): void {
  useLive.setState({state: {...emptyLiveState(), canUndo}});
}

function setLayers(layers: Partial<LiveLayers>): void {
  useLive.setState({
    state: {...emptyLiveState(), layers: {...emptyLayers(), ...layers}},
  });
}

const slide = {itemId: 'a', position: 0, label: null, lines: ['x']};
const media = {mediaId: 'm', loop: true, startedAt: 0};

beforeEach(() => {
  sent.length = 0;
  installApi();
  useLive.setState({state: null});
});

afterEach(() => {
  resetTooltips();
  cleanup();
  delete window.llp;
});

describe('hasSomethingToClear', () => {
  it('checks one layer, and any layer for all', () => {
    const layers = {...emptyLayers(), slide};
    expect(hasSomethingToClear(layers, 'slide')).toBe(true);
    expect(hasSomethingToClear(layers, 'media')).toBe(false);
    expect(hasSomethingToClear(layers, 'all')).toBe(true);
    expect(hasSomethingToClear(emptyLayers(), 'all')).toBe(false);
  });
});

describe('ClearRow', () => {
  it('has a group with the seven clear buttons by default, in order', () => {
    render(<ClearRow compact={false} />);
    const group = screen.getByRole('group', {name: '지우기'});
    const names = Array.from(group.querySelectorAll('button')).map(button =>
      button.getAttribute('aria-label'),
    );
    expect(names).toEqual([
      '모두 지우기',
      '가사 지우기',
      '미디어 지우기',
      '소품 지우기',
      '오디오 지우기',
      '메시지 지우기',
      '공지 지우기',
    ]);
  });

  it.each([undefined, false])(
    'hides undo and its divider for preference %s',
    async setting => {
      installApi(setting);
      setCanUndo(true);
      const state = useLive.getState().state;
      render(<ClearRow compact={false} />);
      await act(async () => undefined);
      const group = screen.getByRole('group', {name: '지우기'});
      expect(group.querySelectorAll('button')).toHaveLength(7);
      expect(screen.queryByRole('button', {name: '되돌리기'})).toBeNull();
      expect(group.querySelector('[aria-hidden="true"]')).toBeNull();
      expect(useLive.getState().state).toBe(state);
      expect(sent).toEqual([]);
    },
  );

  it('stays hidden without preload', () => {
    delete window.llp;
    render(<ClearRow compact={false} />);
    expect(screen.queryByRole('button', {name: '되돌리기'})).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(7);
  });

  it('shows only undo and its divider after an enabled preference arrives', async () => {
    const api = installApi();
    let finish: (value: typeof defaultPreferences) => void = () => undefined;
    vi.spyOn(api.preferences, 'get').mockImplementation(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    setCanUndo(true);
    const state = useLive.getState().state;
    render(<ClearRow compact={false} />);
    expect(screen.queryByRole('button', {name: '되돌리기'})).toBeNull();
    iconRenders.names.length = 0;
    await act(async () =>
      finish({...defaultPreferences, show: {showClearUndoButton: true}}),
    );
    const group = screen.getByRole('group', {name: '지우기'});
    expect(
      [...group.querySelectorAll('button')].at(-1)?.getAttribute('aria-label'),
    ).toBe('되돌리기');
    expect(group.querySelectorAll('[aria-hidden="true"]')).toHaveLength(1);
    expect(iconRenders.names).toEqual(['undo']);
    expect(useLive.getState().state).toBe(state);
    expect(sent).toEqual([]);
  });

  it('keeps undo hidden when the preference read fails', async () => {
    const api = installApi();
    vi.spyOn(api.preferences, 'get').mockRejectedValue(
      new Error('Read failed'),
    );
    render(<ClearRow compact={false} />);
    await act(async () => undefined);
    expect(screen.queryByRole('button', {name: '되돌리기'})).toBeNull();
    expect(sent).toEqual([]);
  });

  it('gives each button its shortcut and a tooltip with it', async () => {
    render(<ClearRow compact={false} />);
    const lyrics = screen.getByRole('button', {name: '가사 지우기'});
    expect(lyrics.getAttribute('aria-keyshortcuts')).toBe('F2');
    expect(lyrics.hasAttribute('title')).toBe(false);
    expect((await hoverForTooltip(lyrics))?.textContent).toBe('가사 지우기F2');
  });

  it('gives the undo button a tooltip with its name and no shortcut', async () => {
    await renderWithUndo();
    const undo = screen.getByRole('button', {name: '되돌리기'});
    expect(undo.hasAttribute('aria-keyshortcuts')).toBe(false);
    expect((await hoverForTooltip(undo))?.textContent).toBe('되돌리기');
  });

  it('uses no native title tooltip', () => {
    render(<ClearRow compact />);
    expect(document.querySelectorAll('[title]')).toHaveLength(0);
  });

  it('dims a layer with nothing to clear and keeps the button focusable', () => {
    setLayers({slide});
    render(<ClearRow compact={false} />);
    const lyrics = screen.getByRole('button', {name: '가사 지우기'});
    const media = screen.getByRole('button', {name: '미디어 지우기'});
    expect(lyrics.getAttribute('aria-disabled')).toBe('false');
    expect(lyrics.getAttribute('data-state')).toBeNull();
    expect(media.getAttribute('aria-disabled')).toBe('true');
    expect(media.getAttribute('data-state')).toBe('off');
    expect(media.hasAttribute('disabled')).toBe(false);
  });

  it('keeps all bright while any layer has something', () => {
    setLayers({media});
    render(<ClearRow compact={false} />);
    expect(
      screen
        .getByRole('button', {name: '모두 지우기'})
        .getAttribute('data-state'),
    ).toBeNull();
  });

  it('toggles the layer of a bright button with layer.clear.toggle', () => {
    setLayers({slide});
    render(<ClearRow compact={false} />);
    fireEvent.click(screen.getByRole('button', {name: '가사 지우기'}));
    expect(sent).toEqual([{type: 'layer.clear.toggle', target: 'slide'}]);
  });

  it('clears everything with the all button', () => {
    setLayers({slide, media});
    render(<ClearRow compact={false} />);
    fireEvent.click(screen.getByRole('button', {name: '모두 지우기'}));
    expect(sent).toEqual([{type: 'layer.clear.toggle', target: 'all'}]);
  });

  it('offers a pressed restore button after its layer has been cleared', async () => {
    useLive.setState({state: {...emptyLiveState(), clearToggles: ['slide']}});
    render(<ClearRow compact={false} />);
    const button = screen.getByRole('button', {name: '가사 복원'});
    expect(button.getAttribute('aria-disabled')).toBe('false');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect((await hoverForTooltip(button))?.textContent).toBe('가사 복원F2');
    fireEvent.click(button);
    expect(sent).toEqual([{type: 'layer.clear.toggle', target: 'slide'}]);
    act(() => setLayers({slide}));
    expect(
      screen
        .getByRole('button', {name: '가사 지우기'})
        .getAttribute('aria-pressed'),
    ).toBe('false');
  });

  it('does nothing when a dim button is clicked', () => {
    setLayers({slide});
    render(<ClearRow compact={false} />);
    fireEvent.click(screen.getByRole('button', {name: '오디오 지우기'}));
    expect(sent).toHaveLength(0);
  });

  it('sends clear.undo from the undo button while there is something to undo', async () => {
    await renderWithUndo();
    act(() => setCanUndo(true));
    const undo = screen.getByRole('button', {name: '되돌리기'});
    expect(undo.getAttribute('aria-disabled')).toBe('false');
    expect(undo.getAttribute('data-state')).toBeNull();
    fireEvent.click(undo);
    expect(sent).toEqual([{type: 'clear.undo'}]);
  });

  it('dims the undo button and sends nothing when there is nothing to undo', async () => {
    await renderWithUndo();
    act(() => setCanUndo(false));
    const undo = screen.getByRole('button', {name: '되돌리기'});
    expect(undo.getAttribute('aria-disabled')).toBe('true');
    expect(undo.getAttribute('data-state')).toBe('off');
    expect(undo.hasAttribute('disabled')).toBe(false);
    fireEvent.click(undo);
    expect(sent).toHaveLength(0);
  });

  it('dims the undo button before the first live state arrives', async () => {
    const api = installApi(true);
    const firstState = emptyLiveState();
    let finish: () => void = () => undefined;
    vi.spyOn(api.live, 'get').mockImplementation(
      () =>
        new Promise(resolve => {
          finish = () => resolve(firstState);
        }),
    );
    render(<ClearRow compact={false} />);
    onTestFinished(startLiveSync());
    await screen.findByRole('button', {name: '되돌리기'});
    expect(useLive.getState().state).toBeNull();
    expect(
      screen.getByRole('button', {name: '되돌리기'}).getAttribute('data-state'),
    ).toBe('off');
    await act(async () => finish());
    expect(useLive.getState().state).toBe(firstState);
  });

  it('redraws only the undo button when canUndo changes', async () => {
    await renderWithUndo();
    act(() => setCanUndo(false));
    iconRenders.names.length = 0;
    act(() => setCanUndo(true));
    expect(iconRenders.names).toEqual(['undo']);
  });

  it('redraws only the buttons whose layer changed when the layers change', () => {
    setLayers({});
    render(<ClearRow compact={false} />);
    iconRenders.names.length = 0;
    act(() => setLayers({slide}));
    expect([...iconRenders.names].sort()).toEqual(['layers', 'text']);
  });

  it('redraws exactly the buttons that changed when the layers and canUndo change together', async () => {
    await renderWithUndo();
    act(() => setLayers({}));
    iconRenders.names.length = 0;
    act(() =>
      useLive.setState({
        state: {
          ...emptyLiveState(),
          layers: {...emptyLayers(), slide},
          canUndo: true,
        },
      }),
    );
    expect([...iconRenders.names].sort()).toEqual(['layers', 'text', 'undo']);
  });

  it('follows the live state when a clear becomes undoable and when it is undone', async () => {
    await renderWithUndo();
    act(() => setCanUndo(false));
    const undo = screen.getByRole('button', {name: '되돌리기'});
    act(() => setCanUndo(true));
    expect(undo.getAttribute('data-state')).toBeNull();
    act(() => setCanUndo(false));
    expect(undo.getAttribute('data-state')).toBe('off');
  });

  it('shows the names in the regular form and only icons in the compact form', async () => {
    const {unmount} = await renderWithUndo();
    expect(screen.getByText('가사')).toBeTruthy();
    expect(screen.getByText('되돌림')).toBeTruthy();
    unmount();
    await renderWithUndo(true);
    expect(screen.queryByText('가사')).toBeNull();
    expect(screen.getByRole('button', {name: '가사 지우기'})).toBeTruthy();
  });
});
