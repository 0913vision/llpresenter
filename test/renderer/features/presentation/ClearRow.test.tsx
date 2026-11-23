import {emptyLayers, emptyLiveState, type LiveLayers} from '@core/schema/live';
import {shownText} from '@fixtures/core/liveSlide';
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {LiveCommand} from '@core/schema/liveCommand';
import type {LlpApi} from '@contracts/ipc/api';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {useLive} from '@renderer/session/live';
import {
  hoverForTooltip,
  resetTooltips,
} from '@fixtures/renderer/ui/tooltipTesting';
import {ClearRow} from '@renderer/features/presentation/ClearRow';

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

function installApi(): LlpApi {
  const api = mockLlpApi({
    live: {
      get: async () => emptyLiveState(),
      send: command => sent.push(command),
      subscribe: () => () => undefined,
    },
  });
  window.llp = api;
  return api;
}

function renderWithUndo(compact = false) {
  installApi();
  setCanUndo(true);
  return render(<ClearRow compact={compact} />);
}

function setCanUndo(canUndo: boolean): void {
  useLive.setState({state: {...emptyLiveState(), canUndo}});
}

function setLayers(layers: Partial<LiveLayers>): void {
  useLive.setState({
    state: {...emptyLiveState(), layers: {...emptyLayers(), ...layers}},
  });
}

const slide = {itemId: 'a', position: 0, ...shownText(['x'])};
const media = {mediaId: 'm', loop: true, startedAt: 0};

function renderActiveItemOff() {
  const send = vi.fn();
  window.llp = mockLlpApi({live: {send}});
  useLive.setState({
    state: {
      ...emptyLiveState(),
      item: {id: 'item', kind: 'song', source: 'service'},
    },
  });
  render(<ClearRow compact={false} />);
  const button = screen.getByRole('button', {name: '대기 화면으로'});
  return {button, send};
}

it('activates Item Off with unmodified Space and Enter', async () => {
  const {button, send} = renderActiveItemOff();
  button.focus();
  await userEvent.keyboard(' {Enter}');
  expect(send.mock.calls).toEqual([
    [{type: 'item.stop'}],
    [{type: 'item.stop'}],
  ]);
});

it('dismisses the Item Off tooltip and clears pending activation on blur', async () => {
  const {button, send} = renderActiveItemOff();
  expect(await hoverForTooltip(button)).not.toBeNull();
  fireEvent.keyDown(button, {key: 'Enter', ctrlKey: true});
  fireEvent.blur(button);
  expect(screen.queryByRole('tooltip')).toBeNull();
  fireEvent.click(button, {detail: 0});
  expect(send).toHaveBeenCalledExactlyOnceWith({type: 'item.stop'});
});

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

describe('ClearRow', () => {
  it('keeps undo in the row, off, while there is nothing to bring back', () => {
    installApi();
    setCanUndo(false);
    const state = useLive.getState().state;
    render(<ClearRow compact={false} />);
    const group = screen.getByRole('group', {name: '지우기'});
    expect(
      [...group.querySelectorAll('button')].map(button => button.textContent),
    ).toEqual([
      '대기 화면',
      '모두',
      '가사',
      '미디어',
      '그래픽',
      '오디오',
      '메시지',
      '되돌리기',
    ]);
    const undo = screen.getByRole('button', {name: '되돌리기'});
    expect(undo.getAttribute('aria-disabled')).toBe('true');
    expect(undo.getAttribute('data-state')).toBe('off');
    fireEvent.click(undo);
    expect(useLive.getState().state).toBe(state);
    expect(sent).toEqual([]);
  });

  it('gives the row the same buttons whether or not a clear can be brought back', () => {
    installApi();
    setCanUndo(false);
    const off = render(<ClearRow compact={false} />);
    const before = [...off.container.querySelectorAll('button')].map(
      button => button.className,
    );
    act(() => setCanUndo(true));
    const after = [...off.container.querySelectorAll('button')].map(
      button => button.className,
    );
    expect(after).toEqual(before);
  });

  it('keeps undo off without preload', () => {
    delete window.llp;
    render(<ClearRow compact={false} />);
    const undo = screen.getByRole('button', {name: '되돌리기'});
    expect(undo.getAttribute('aria-disabled')).toBe('true');
    expect(screen.getAllByRole('button')).toHaveLength(8);
  });

  it('gives each button its shortcut and a tooltip with it', async () => {
    render(<ClearRow compact={false} />);
    const lyrics = screen.getByRole('button', {name: '가사 지우기'});
    expect(lyrics.getAttribute('aria-keyshortcuts')).toBe('F2');
    expect(lyrics.hasAttribute('title')).toBe(false);
    expect((await hoverForTooltip(lyrics))?.textContent).toBe('가사 지우기F2');
  });

  it('gives the undo button a tooltip with its name and no shortcut', async () => {
    renderWithUndo();
    const undo = screen.getByRole('button', {name: '되돌리기'});
    expect(undo.hasAttribute('aria-keyshortcuts')).toBe(false);
    expect((await hoverForTooltip(undo))?.textContent).toBe('되돌리기');
  });

  it('dims a layer with nothing to clear and keeps the button focusable', () => {
    setLayers({slide});
    render(<ClearRow compact={false} />);
    const lyrics = screen.getByRole('button', {name: '가사 지우기'});
    const media = screen.getByRole('button', {name: '미디어 지우기'});
    expect(lyrics.getAttribute('aria-disabled')).toBeNull();
    expect(lyrics.getAttribute('data-state')).toBeNull();
    expect(media.getAttribute('aria-disabled')).toBe('true');
    expect(media.getAttribute('data-state')).toBe('off');
    expect(media.hasAttribute('disabled')).toBe(false);
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
    const button = screen.getByRole('button', {name: '가사 되돌리기'});
    expect(button.getAttribute('aria-disabled')).toBeNull();
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect((await hoverForTooltip(button))?.textContent).toBe(
      '가사 되돌리기F2',
    );
    fireEvent.click(button);
    expect(sent).toEqual([{type: 'layer.clear.toggle', target: 'slide'}]);
    act(() => setLayers({slide}));
    expect(
      screen
        .getByRole('button', {name: '가사 지우기'})
        .getAttribute('aria-pressed'),
    ).toBe('false');
  });

  it('sends clear.undo from the undo button', () => {
    renderWithUndo();
    fireEvent.click(screen.getByRole('button', {name: '되돌리기'}));
    expect(sent).toEqual([{type: 'clear.undo'}]);
  });

  it('turns the undo button off when there is nothing left to bring back', () => {
    renderWithUndo();
    act(() => setCanUndo(false));
    expect(
      screen
        .getByRole('button', {name: '되돌리기'})
        .getAttribute('aria-disabled'),
    ).toBe('true');
  });

  it('redraws only the undo button when canUndo changes', () => {
    installApi();
    render(<ClearRow compact={false} />);
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

  it('shows the names in the regular form and only icons in the compact form', () => {
    const {unmount} = renderWithUndo();
    expect(screen.getByText('가사')).toBeTruthy();
    expect(screen.getByText('되돌리기')).toBeTruthy();
    expect(screen.getByText('대기 화면')).toBeTruthy();
    unmount();
    renderWithUndo(true);
    expect(screen.queryByText('가사')).toBeNull();
    expect(screen.queryByText('대기 화면')).toBeNull();
    expect(screen.getByRole('button', {name: '가사 지우기'})).toBeTruthy();
  });

  it('keeps standby and undo apart from the six clears', () => {
    render(<ClearRow compact={false} />);
    const clears = screen.getByRole('button', {
      name: '모두 지우기',
    }).parentElement;
    expect(clears?.querySelectorAll('button')).toHaveLength(6);
    for (const name of ['대기 화면으로', '되돌리기']) {
      expect(clears?.contains(screen.getByRole('button', {name}))).toBe(false);
    }
  });
});
