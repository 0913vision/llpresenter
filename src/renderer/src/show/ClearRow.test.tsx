import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {LiveCommand} from '@shared/commands';
import {emptyLayers, emptyLiveState, type LiveLayers} from '@shared/live';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {useLive} from '@renderer/state/live';
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

function installApi(): void {
  window.llp = fakeLlpApi({
    live: {
      get: async () => emptyLiveState(),
      send: command => sent.push(command),
      subscribe: () => () => undefined,
    },
  });
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
  it('has a group with the seven buttons and the undo button, in order', () => {
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
      '되돌리기',
    ]);
  });

  it('gives each button its shortcut and a tooltip with it', async () => {
    render(<ClearRow compact={false} />);
    const lyrics = screen.getByRole('button', {name: '가사 지우기'});
    expect(lyrics.getAttribute('aria-keyshortcuts')).toBe('F2');
    expect(lyrics.hasAttribute('title')).toBe(false);
    expect((await hoverForTooltip(lyrics))?.textContent).toBe('가사 지우기F2');
  });

  it('gives the undo button a tooltip with its name and no shortcut', async () => {
    render(<ClearRow compact={false} />);
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

  it('clears the layer of a bright button with layer.clear', () => {
    setLayers({slide});
    render(<ClearRow compact={false} />);
    fireEvent.click(screen.getByRole('button', {name: '가사 지우기'}));
    expect(sent).toEqual([{type: 'layer.clear', target: 'slide'}]);
  });

  it('clears everything with the all button', () => {
    setLayers({slide, media});
    render(<ClearRow compact={false} />);
    fireEvent.click(screen.getByRole('button', {name: '모두 지우기'}));
    expect(sent).toEqual([{type: 'layer.clear', target: 'all'}]);
  });

  it('does nothing when a dim button is clicked', () => {
    setLayers({slide});
    render(<ClearRow compact={false} />);
    fireEvent.click(screen.getByRole('button', {name: '오디오 지우기'}));
    expect(sent).toHaveLength(0);
  });

  it('sends clear.undo from the undo button while there is something to undo', () => {
    setCanUndo(true);
    render(<ClearRow compact={false} />);
    const undo = screen.getByRole('button', {name: '되돌리기'});
    expect(undo.getAttribute('aria-disabled')).toBe('false');
    expect(undo.getAttribute('data-state')).toBeNull();
    fireEvent.click(undo);
    expect(sent).toEqual([{type: 'clear.undo'}]);
  });

  it('dims the undo button and sends nothing when there is nothing to undo', () => {
    setCanUndo(false);
    render(<ClearRow compact={false} />);
    const undo = screen.getByRole('button', {name: '되돌리기'});
    expect(undo.getAttribute('aria-disabled')).toBe('true');
    expect(undo.getAttribute('data-state')).toBe('off');
    expect(undo.hasAttribute('disabled')).toBe(false);
    fireEvent.click(undo);
    expect(sent).toHaveLength(0);
  });

  it('dims the undo button before the first live state arrives', () => {
    render(<ClearRow compact={false} />);
    expect(
      screen.getByRole('button', {name: '되돌리기'}).getAttribute('data-state'),
    ).toBe('off');
  });

  it('redraws only the undo button when canUndo changes', () => {
    setCanUndo(false);
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

  it('redraws exactly the buttons that changed when the layers and canUndo change together', () => {
    setLayers({});
    render(<ClearRow compact={false} />);
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

  it('follows the live state when a clear becomes undoable and when it is undone', () => {
    setCanUndo(false);
    render(<ClearRow compact={false} />);
    const undo = screen.getByRole('button', {name: '되돌리기'});
    act(() => setCanUndo(true));
    expect(undo.getAttribute('data-state')).toBeNull();
    act(() => setCanUndo(false));
    expect(undo.getAttribute('data-state')).toBe('off');
  });

  it('shows the names in the regular form and only icons in the compact form', () => {
    const {unmount} = render(<ClearRow compact={false} />);
    expect(screen.getByText('가사')).toBeTruthy();
    expect(screen.getByText('되돌림')).toBeTruthy();
    unmount();
    render(<ClearRow compact />);
    expect(screen.queryByText('가사')).toBeNull();
    expect(screen.getByRole('button', {name: '가사 지우기'})).toBeTruthy();
  });
});
