import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import type {LiveCommand} from '@shared/commands';
import {emptyLiveState} from '@shared/live';
import type {LlpApi} from '@shared/ipc';
import {useLive} from '@renderer/state/live';
import {openItem, useShow} from '@renderer/state/show';
import {ServiceOrderList} from './ServiceOrderList';
import {SlideGrid} from './SlideGrid';

const sent: LiveCommand[] = [];

function installApi(): void {
  const api: LlpApi = {
    live: {
      get: async () => emptyLiveState(),
      send: command => sent.push(command),
      subscribe: () => () => undefined,
    },
    window: {control: () => undefined},
  };
  window.llp = api;
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
  useShow.setState({openItemId: null, selectedTile: 0});
  useLive.setState({state: null});
});

afterEach(() => {
  cleanup();
  delete window.llp;
});

describe('ServiceOrderList', () => {
  it('shows headers as text and items as options', () => {
    render(<ServiceOrderList />);
    expect(screen.getByText('찬양')).toBeTruthy();
    expect(screen.queryByRole('option', {name: '찬양'})).toBeNull();
    expect(screen.getByRole('option', {name: /아침이 밝아 오네/})).toBeTruthy();
  });

  it('selects an item on click without outputting anything', () => {
    render(<ServiceOrderList />);
    fireEvent.click(screen.getByRole('option', {name: /맑은 시냇물/}));
    expect(useShow.getState().openItemId).toBe('song-river');
    expect(sent).toHaveLength(0);
  });

  it('marks the selected item', () => {
    openItem('song-river');
    render(<ServiceOrderList />);
    const selected = screen
      .getAllByRole('option')
      .filter(option => option.getAttribute('aria-selected') === 'true');
    expect(selected).toHaveLength(1);
    expect(selected[0]?.textContent).toContain('맑은 시냇물');
  });

  it('shows the LIVE badge on the item of the live 장 only', () => {
    setLiveSlide('song-river', 1);
    render(<ServiceOrderList />);
    const live = screen.getByRole('option', {name: /맑은 시냇물/});
    expect(live.textContent).toContain('LIVE');
    expect(screen.getAllByText('LIVE')).toHaveLength(1);
  });

  it('moves between rows with the arrow keys, Home, and End', () => {
    render(<ServiceOrderList />);
    const list = screen.getByRole('listbox', {name: '예배 순서'});
    fireEvent.keyDown(list, {key: 'Home'});
    expect(useShow.getState().openItemId).toBe('countdown');
    fireEvent.keyDown(list, {key: 'ArrowDown'});
    expect(useShow.getState().openItemId).toBe('song-morning');
    fireEvent.keyDown(list, {key: 'ArrowUp'});
    expect(useShow.getState().openItemId).toBe('countdown');
    fireEvent.keyDown(list, {key: 'End'});
    expect(useShow.getState().openItemId).toBe('notice-sunday');
  });
});

describe('SlideGrid', () => {
  it('shows nothing when no item is open', () => {
    render(<SlideGrid columns={3} />);
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('shows one tile per 장 of the 구성, with its number and 이름표', () => {
    openItem('song-morning');
    render(<SlideGrid columns={3} />);
    const tiles = screen.getAllByRole('option');
    expect(tiles).toHaveLength(4);
    expect(tiles[1]?.getAttribute('aria-label')).toBe(
      '2 후렴 함께 불러요 함께 노래해요',
    );
  });

  it('sets the number of columns', () => {
    openItem('song-morning');
    render(<SlideGrid columns={6} />);
    const grid = screen.getByRole('listbox', {name: '장'});
    expect(grid.style.gridTemplateColumns).toBe('repeat(6, minmax(0, 1fr))');
  });

  it('outputs a 장 with slide.show when its tile is clicked', () => {
    openItem('song-morning');
    render(<SlideGrid columns={3} />);
    const tile = screen.getAllByRole('option').at(2);
    if (!tile) throw new Error('The third tile is missing');
    fireEvent.click(tile);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      type: 'slide.show',
      slide: {itemId: 'song-morning', position: 2, label: '2절'},
    });
  });

  it('marks only the live tile and only in its own item', () => {
    setLiveSlide('song-morning', 1);
    openItem('song-morning');
    const {unmount} = render(<SlideGrid columns={3} />);
    const states = screen
      .getAllByRole('option')
      .map(tile => tile.getAttribute('data-state'));
    expect(states).toEqual([null, 'live', null, null]);
    unmount();

    openItem('song-river');
    render(<SlideGrid columns={3} />);
    const other = screen
      .getAllByRole('option')
      .map(tile => tile.getAttribute('data-state'));
    expect(other).toEqual([null, null, null]);
  });

  it('keeps one tab stop on the selected tile', () => {
    openItem('song-morning');
    render(<SlideGrid columns={3} />);
    const stops = screen
      .getAllByRole('option')
      .filter(tile => tile.tabIndex === 0);
    expect(stops).toHaveLength(1);
  });

  it('moves the selection with the arrow keys and outputs nothing', () => {
    openItem('song-morning');
    render(<SlideGrid columns={3} />);
    const grid = screen.getByRole('listbox', {name: '장'});
    fireEvent.keyDown(grid, {key: 'ArrowRight'});
    fireEvent.keyDown(grid, {key: 'ArrowRight'});
    expect(useShow.getState().selectedTile).toBe(2);
    fireEvent.keyDown(grid, {key: 'ArrowDown'});
    expect(useShow.getState().selectedTile).toBe(2);
    fireEvent.keyDown(grid, {key: 'ArrowLeft'});
    expect(useShow.getState().selectedTile).toBe(1);
    expect(sent).toHaveLength(0);
  });
});
