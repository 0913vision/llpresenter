import {lastLiveCommand} from '@fixtures/renderer/session/liveCommands';
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {LiveCommand} from '@core/live/commands';
import {emptyLiveState} from '@core/live/state';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {useLive} from '@renderer/session/live';
import {applyService, openItem, useShow} from '@renderer/session/show';
import {
  sampleService,
  seedSampleService,
} from '@fixtures/renderer/session/sampleService';
import {SlideGrid} from '@renderer/features/presentation/SlideGrid';

const sent: LiveCommand[] = [];

function installApi(): void {
  window.llp = mockLlpApi({
    live: {
      get: async () => emptyLiveState(),
      send: command => sent.push(command),
      subscribe: () => () => undefined,
    },
  });
}

function setLiveSlide(itemId: string, position: number): void {
  const base = emptyLiveState();
  useLive.setState({
    state: {
      ...base,
      layers: {
        ...base.layers,
        slide: {itemId, position, label: null, lines: ['x']},
      },
    },
  });
}

beforeEach(() => {
  sent.length = 0;
  installApi();
  seedSampleService();
  useShow.setState({openItemId: null, selectedTile: 0});
  useLive.setState({state: null});
});

afterEach(() => {
  cleanup();
  delete window.llp;
});

const iconRenders = vi.hoisted((): string[] => []);

vi.mock('@renderer/ui/Icon', () => ({
  Icon: ({name}: {readonly name: string}): null => {
    iconRenders.push(name);
    return null;
  },
}));

describe('SlideGrid', () => {
  it('shows nothing when no item is open', () => {
    render(<SlideGrid columns={3} scalePercent={100} />);
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('shows one tile per 장 of the 구성, with its number and 이름표', () => {
    openItem('song-morning');
    render(<SlideGrid columns={3} scalePercent={100} />);
    const tiles = screen.getAllByRole('option');
    expect(tiles).toHaveLength(4);
    expect(tiles[1]?.getAttribute('aria-label')).toBe(
      '2 후렴, 함께 불러요 함께 노래해요',
    );
  });

  it('outputs a 장 with slide.show when its tile is clicked', () => {
    openItem('song-morning');
    render(<SlideGrid columns={3} scalePercent={100} />);
    const tile = screen.getAllByRole('option').at(2);
    if (!tile) throw new Error('The third tile is missing');
    fireEvent.click(tile);
    expect(sent).toHaveLength(1);
    expect(lastLiveCommand(sent[0])).toMatchObject({
      type: 'slide.show',
      slide: {itemId: 'song-morning', position: 2, label: '2절'},
    });
  });

  it('marks only the live tile and only in its own item', () => {
    setLiveSlide('song-morning', 1);
    openItem('song-morning');
    const {unmount} = render(<SlideGrid columns={3} scalePercent={100} />);
    const states = screen
      .getAllByRole('option')
      .map(tile => tile.getAttribute('data-state'));
    expect(states).toEqual([null, 'live', null, null]);
    unmount();

    openItem('song-river');
    render(<SlideGrid columns={3} scalePercent={100} />);
    const other = screen
      .getAllByRole('option')
      .map(tile => tile.getAttribute('data-state'));
    expect(other).toEqual([null, null, null]);
  });

  it('keeps the focus in the grid when another item replaces the focused tile', () => {
    openItem('song-morning');
    render(<SlideGrid columns={2} scalePercent={100} />);
    const grid = screen.getByRole('listbox');
    grid.focus();
    expect(document.activeElement).toBe(grid);
    act(() => openItem('song-river'));
    const next = screen.getAllByRole('option');
    expect(next).toHaveLength(3);
    expect(document.activeElement).toBe(grid);
    expect(
      sent.filter(command => command.type !== 'stage.next.set'),
    ).toHaveLength(0);
  });

  it('keeps the focus in the grid when a service update removes the focused tile of the same item', () => {
    seedSampleService();
    openItem('song-morning');
    render(<SlideGrid columns={2} scalePercent={100} />);
    act(() => useShow.setState({selectedTile: 3}));
    const grid = screen.getByRole('listbox');
    grid.focus();
    const shorter = sampleService.tiles['song-morning']?.slice(0, 2) ?? [];
    act(() =>
      applyService({
        ...sampleService,
        revision: 2,
        tiles: {...sampleService.tiles, 'song-morning': shorter},
      }),
    );
    const tiles = screen.getAllByRole('option');
    expect(tiles).toHaveLength(2);
    expect(useShow.getState().selectedTile).toBe(1);
    expect(document.activeElement).toBe(grid);
    expect(sent).toHaveLength(0);
  });

  it('does not take the focus when it was not in the grid', () => {
    openItem('song-morning');
    render(<SlideGrid columns={2} scalePercent={100} />);
    act(() => openItem('song-river'));
    expect(document.activeElement).toBe(document.body);
  });

  it('does not take the focus back after a press outside the grid', () => {
    openItem('song-morning');
    render(
      <>
        <button type="button">outside</button>
        <SlideGrid columns={2} scalePercent={100} />
      </>,
    );
    screen.getByRole('listbox').focus();
    fireEvent.pointerDown(screen.getByRole('button', {name: 'outside'}));
    screen.getByRole('listbox').blur();
    act(() => openItem('song-river'));
    expect(document.activeElement).toBe(document.body);
  });

  it('outputs a row from the live slide with up and down', () => {
    openItem('song-morning');
    setLiveSlide('song-morning', 0);
    render(<SlideGrid columns={2} scalePercent={100} />);
    const grid = screen.getByRole('listbox');
    grid.focus();
    fireEvent.keyDown(grid, {key: 'ArrowDown'});
    expect(lastLiveCommand(sent.at(-1))).toMatchObject({
      type: 'slide.show',
      slide: {itemId: 'song-morning', position: 2},
    });
    act(() => setLiveSlide('song-morning', 2));
    fireEvent.keyDown(grid, {key: 'ArrowUp'});
    expect(lastLiveCommand(sent.at(-1))).toMatchObject({
      type: 'slide.show',
      slide: {itemId: 'song-morning', position: 0},
    });
    expect(document.activeElement).toBe(grid);
  });
});
