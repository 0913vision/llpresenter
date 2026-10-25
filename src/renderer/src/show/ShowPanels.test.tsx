import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {LiveCommand} from '@shared/commands';
import {emptyLiveState} from '@shared/live';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {useLive} from '@renderer/state/live';
import {
  applyService,
  openItem,
  selectTile,
  useShow,
} from '@renderer/state/show';
import {sampleService, seedSampleService} from './testing/sampleService';
import {ServiceOrderList} from './ServiceOrderList';
import {SlideGrid} from './SlideGrid';

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

describe('ServiceOrderList', () => {
  it('is a 진행 list, whose rows draw no keyboard focus outline', () => {
    render(<ServiceOrderList />);
    const list = screen.getByRole('listbox', {name: '예배 순서'});
    expect(list.dataset['workspace']).toBe('show');
  });

  it('shows headers as text and items as options', () => {
    render(<ServiceOrderList />);
    expect(screen.getByText('찬양')).toBeTruthy();
    expect(screen.queryByRole('option', {name: '찬양'})).toBeNull();
    expect(screen.getByRole('option', {name: /아침이 밝아 오네/})).toBeTruthy();
  });

  it('explains the problem of a row in its tooltip, and only then', () => {
    applyService({
      ...sampleService,
      revision: 2,
      rows: [
        {kind: 'song', id: 'ok', title: '정상'},
        {kind: 'song', id: 'gone', title: '없는 곡', problem: 'missing-song'},
        {kind: 'unknown', id: 'new', title: '새 항목', problem: 'unknown-kind'},
      ],
    });
    render(<ServiceOrderList />);
    const marks = screen.getAllByRole('img').map(mark => mark.ariaLabel);
    expect(marks).toEqual([
      '곡 파일을 찾을 수 없습니다.',
      '이 버전에서 알 수 없는 항목입니다.',
    ]);
    expect(
      within(screen.getByRole('option', {name: /정상/})).queryByRole('img'),
    ).toBeNull();
    expect(
      within(screen.getByRole('option', {name: /없는 곡/})).getByRole('img'),
    ).toBeTruthy();
  });

  it('shows no rows while no service is open', () => {
    applyService(null);
    render(<ServiceOrderList />);
    expect(screen.queryAllByRole('option')).toHaveLength(0);
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

  it('keeps one tab stop: the first row until an item is open, then its row', () => {
    render(<ServiceOrderList />);
    const list = screen.getByRole('listbox', {name: '예배 순서'});
    const rowStops = (): Array<string | null> =>
      screen
        .getAllByRole('option')
        .filter(option => option.tabIndex === 0)
        .map(row => row.textContent);
    expect(list.hasAttribute('tabindex')).toBe(false);
    expect(rowStops()).toEqual([expect.stringContaining('예배 전 카운트다운')]);
    act(() => openItem('song-river'));
    expect(rowStops()).toEqual([expect.stringContaining('맑은 시냇물')]);
  });

  it('moves focus with the arrow keys so that Enter acts on the focused row', () => {
    render(<ServiceOrderList />);
    const first = screen.getByRole('option', {name: /아침이 밝아 오네/});
    fireEvent.click(first);
    first.focus();
    const list = screen.getByRole('listbox', {name: '예배 순서'});
    fireEvent.keyDown(first, {key: 'ArrowDown'});
    const second = screen.getByRole('option', {name: /맑은 시냇물/});
    expect(useShow.getState().openItemId).toBe('song-river');
    expect(document.activeElement).toBe(second);
    expect(second.tabIndex).toBe(0);
    expect(first.tabIndex).toBe(-1);
    expect(list.contains(document.activeElement)).toBe(true);
    fireEvent.click(document.activeElement ?? document.body);
    expect(useShow.getState().openItemId).toBe('song-river');
  });

  it('redraws only the rows whose open state changed', () => {
    openItem('song-morning');
    render(<ServiceOrderList />);
    iconRenders.length = 0;
    act(() => openItem('psalm-23'));
    expect(iconRenders.toSorted()).toEqual(['book', 'song']);
  });

  it('redraws only the rows whose live mark changed', () => {
    setLiveSlide('song-morning', 0);
    render(<ServiceOrderList />);
    iconRenders.length = 0;
    act(() => setLiveSlide('psalm-23', 0));
    expect(iconRenders.toSorted()).toEqual(['book', 'song']);
  });

  it('does not take focus when the selection changes from elsewhere', () => {
    render(<ServiceOrderList />);
    openItem('song-river');
    expect(document.activeElement).toBe(document.body);
  });

  it('leaves Ctrl Down and Ctrl Up to the item commands instead of moving the focused row', () => {
    openItem('song-morning');
    render(<ServiceOrderList />);
    const row = screen.getByRole('option', {name: /아침이 밝아 오네/});
    row.focus();
    const down = fireEvent.keyDown(row, {key: 'ArrowDown', ctrlKey: true});
    expect(useShow.getState().openItemId).toBe('song-morning');
    expect(down).toBe(true);
    const up = fireEvent.keyDown(row, {key: 'ArrowUp', ctrlKey: true});
    expect(useShow.getState().openItemId).toBe('song-morning');
    expect(up).toBe(true);
  });

  it('moves between rows with the arrow keys, Home, and End', () => {
    render(<ServiceOrderList />);
    const press = (key: string): void => {
      fireEvent.keyDown(document.activeElement ?? document.body, {key});
    };
    screen.getByRole('option', {name: /아침이 밝아 오네/}).focus();
    press('Home');
    expect(useShow.getState().openItemId).toBe('countdown');
    press('ArrowDown');
    expect(useShow.getState().openItemId).toBe('song-morning');
    press('ArrowUp');
    expect(useShow.getState().openItemId).toBe('countdown');
    press('End');
    expect(useShow.getState().openItemId).toBe('notice-sunday');
  });

  it.each([
    {
      end: 'last',
      itemId: 'song-river',
      title: /맑은 시냇물/,
      keys: ['ArrowDown', 'End'],
    },
    {
      end: 'first',
      itemId: 'song-morning',
      title: /아침이 밝아 오네/,
      keys: ['ArrowUp', 'Home'],
    },
  ])(
    'keeps the tile selection when a key stays on the $end row',
    ({itemId, title, keys}) => {
      applyService({
        ...sampleService,
        revision: 2,
        rows: sampleService.rows.filter(row => row.kind === 'song'),
      });
      openItem(itemId);
      selectTile(2);
      render(<ServiceOrderList />);
      const row = screen.getByRole('option', {name: title});
      row.focus();
      for (const key of keys) fireEvent.keyDown(row, {key});
      expect(useShow.getState()).toMatchObject({
        openItemId: itemId,
        selectedTile: 2,
      });
    },
  );
});

describe('SlideGrid', () => {
  it('is a 진행 grid, whose slides draw no keyboard focus outline', () => {
    openItem('song-morning');
    render(<SlideGrid columns={2} scalePercent={100} />);
    const grid = screen.getByRole('listbox', {name: '슬라이드'});
    expect(grid.dataset['workspace']).toBe('show');
  });

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

  it('names a tile without an 이름표 by its number and first line', () => {
    openItem('psalm-23');
    render(<SlideGrid columns={3} scalePercent={100} />);
    expect(screen.getAllByRole('option')[0]?.getAttribute('aria-label')).toBe(
      '1, 여호와는 나의 목자시니',
    );
  });

  it('sets the number of columns', () => {
    openItem('song-morning');
    render(<SlideGrid columns={6} scalePercent={100} />);
    const grid = screen.getByRole('listbox', {name: '슬라이드'});
    expect(grid.style.getPropertyValue('--thumb-columns')).toBe('6');
  });

  it('outputs a 장 with slide.show when its tile is clicked', () => {
    openItem('song-morning');
    render(<SlideGrid columns={3} scalePercent={100} />);
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

  it('keeps one tab stop on the selected tile', () => {
    openItem('song-morning');
    render(<SlideGrid columns={3} scalePercent={100} />);
    const stops = screen
      .getAllByRole('option')
      .filter(tile => tile.tabIndex === 0);
    expect(stops).toHaveLength(1);
  });

  it('moves focus with the up and down arrows', () => {
    openItem('song-morning');
    render(<SlideGrid columns={2} scalePercent={100} />);
    const [first, , third] = screen.getAllByRole('option');
    if (!first || !third) throw new Error('The tiles are missing');
    first.focus();
    fireEvent.keyDown(first, {key: 'ArrowDown'});
    expect(document.activeElement).toBe(third);
  });

  it('leaves Ctrl Down to the item commands instead of moving the selection', () => {
    openItem('song-morning');
    render(<SlideGrid columns={2} scalePercent={100} />);
    const notPrevented = fireEvent.keyDown(
      screen.getByRole('listbox', {name: '슬라이드'}),
      {key: 'ArrowDown', ctrlKey: true},
    );
    expect(notPrevented).toBe(true);
    expect(useShow.getState().selectedTile).toBe(0);
  });

  it('keeps the focus in the grid when another item replaces the focused tile', () => {
    openItem('song-morning');
    render(<SlideGrid columns={2} scalePercent={100} />);
    const tiles = screen.getAllByRole('option');
    act(() => useShow.setState({selectedTile: 3}));
    tiles[3]?.focus();
    expect(document.activeElement).toBe(tiles[3]);
    act(() => openItem('song-river'));
    const next = screen.getAllByRole('option');
    expect(next).toHaveLength(3);
    expect(document.activeElement).toBe(next[0]);
    expect(sent).toHaveLength(0);
  });

  it('keeps the focus in the grid when a service update removes the focused tile of the same item', () => {
    seedSampleService();
    openItem('song-morning');
    render(<SlideGrid columns={2} scalePercent={100} />);
    act(() => useShow.setState({selectedTile: 3}));
    screen.getAllByRole('option')[3]?.focus();
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
    expect(document.activeElement).toBe(tiles[1]);
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
    screen.getAllByRole('option')[1]?.focus();
    fireEvent.pointerDown(screen.getByRole('button', {name: 'outside'}));
    screen.getAllByRole('option')[1]?.blur();
    act(() => openItem('song-river'));
    expect(document.activeElement).toBe(document.body);
  });

  it('moves the selection by rows with up and down and outputs nothing', () => {
    openItem('song-morning');
    render(<SlideGrid columns={2} scalePercent={100} />);
    const press = (key: string): void => {
      fireEvent.keyDown(document.activeElement ?? document.body, {key});
    };
    screen.getAllByRole('option')[0]?.focus();
    press('ArrowDown');
    expect(useShow.getState().selectedTile).toBe(2);
    press('ArrowDown');
    expect(useShow.getState().selectedTile).toBe(2);
    press('ArrowUp');
    expect(useShow.getState().selectedTile).toBe(0);
    expect(sent).toHaveLength(0);
  });

  it('leaves the left and right arrows to the next and previous 장', () => {
    openItem('song-morning');
    render(<SlideGrid columns={2} scalePercent={100} />);
    const grid = screen.getByRole('listbox', {name: '슬라이드'});
    const right = fireEvent.keyDown(grid, {key: 'ArrowRight'});
    const left = fireEvent.keyDown(grid, {key: 'ArrowLeft'});
    expect(right && left).toBe(true);
    expect(useShow.getState().selectedTile).toBe(0);
  });
});
