import {handleShowKey} from '@renderer/features/presentation/keyboard/shortcuts';
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {LiveCommand} from '@core/schema/live/liveCommand';
import {emptyLiveState} from '@core/schema/live/live';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {useLive} from '@renderer/session/live';
import {applyService, openItem} from '@renderer/session/show/show';
import {
  sampleService,
  seedSampleService,
} from '@fixtures/renderer/session/sampleService';
import {SlideGrid} from '@renderer/features/presentation/grid/SlideGrid';
import {useShow} from '@renderer/session/show/showStore';

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

beforeEach(() => {
  sent.length = 0;
  installApi();
  seedSampleService();
  useShow.setState({openItemId: null, selectedTile: 0});
  useLive.setState({state: null});
});

afterEach(() => {
  cleanup();
  window.removeEventListener('keydown', handleShowKey);
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
      '3 후렴, 함께 불러요 함께 노래해요',
    );
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
});
