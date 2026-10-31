import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {LiveCommand} from '@core/live/commands';
import {emptyLiveState, type LiveState} from '@core/live/state';
import {createSongGroupId, createSongId} from '@core/schema/ids';
import {mockLlpApi} from '@contracts/ipc/testing/mockLlpApi';
import {useLive} from './live';
import {
  hasSlideHotKey,
  openNextItem,
  openPreviousItem,
  outputHotKey,
  revealLiveItem,
  selectTile,
  openItem,
  outputNext,
  outputPrevious,
  outputTile,
  useShow,
} from './show';
import {seedSampleService} from '@renderer/session/testing/sampleService';

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

function setLive(itemId: string, position: number): void {
  const state: LiveState = {
    ...emptyLiveState(),
    layers: {
      ...emptyLiveState().layers,
      slide: {itemId, position, label: null, lines: ['x']},
    },
  };
  useLive.setState({state});
}

beforeEach(() => {
  sent.length = 0;
  installApi();
  seedSampleService();
  useShow.setState({openItemId: null, selectedTile: 0});
  useLive.setState({state: null});
});

afterEach(() => {
  delete window.llp;
  vi.restoreAllMocks();
});

describe('show state', () => {
  it('opens an item with its first tile selected', () => {
    useShow.setState({selectedTile: 3});
    openItem('song-morning');
    expect(useShow.getState()).toMatchObject({
      openItemId: 'song-morning',
      selectedTile: 0,
    });
  });

  it('keeps the tile selection when the open item is opened again', () => {
    openItem('song-morning');
    selectTile(2);
    openItem('song-morning');
    expect(useShow.getState()).toMatchObject({
      openItemId: 'song-morning',
      selectedTile: 2,
    });
  });

  it('selects a tile of the open item without outputting it', () => {
    openItem('song-morning');
    selectTile(2);
    expect(useShow.getState().selectedTile).toBe(2);
    expect(sent).toHaveLength(0);
  });

  it('sends slide.show for a tile and shows it selected', () => {
    outputTile({itemId: 'song-morning', index: 1});
    expect(sent).toEqual([
      {
        type: 'slide.show',
        slide: {
          itemId: 'song-morning',
          position: 1,
          label: '후렴',
          lines: ['함께 불러요 함께 노래해요'],
          next: {label: '2절', lines: ['낮은 언덕을 넘어', '바람이 불어 오네']},
        },
      },
    ]);
    expect(useShow.getState()).toMatchObject({
      openItemId: 'song-morning',
      selectedTile: 1,
    });
  });

  it('sends nothing for a tile that does not exist', () => {
    outputTile({itemId: 'song-morning', index: 99});
    outputTile({itemId: 'missing', index: 0});
    expect(sent).toHaveLength(0);
  });

  it('outputs the first tile of the open item with next when nothing is live', () => {
    openItem('song-river');
    outputNext();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      type: 'slide.show',
      slide: {itemId: 'song-river', position: 0},
    });
  });

  it('outputs the tile after the live one with next', () => {
    setLive('song-morning', 1);
    outputNext();
    expect(sent[0]).toMatchObject({
      slide: {itemId: 'song-morning', position: 2},
    });
  });

  it('stops after the last tile, does not move on to the next item, and keeps the selection', () => {
    openItem('song-morning');
    outputTile({itemId: 'song-morning', index: 3});
    sent.length = 0;
    setLive('song-morning', 3);
    outputNext();
    expect(sent).toHaveLength(0);
    expect(useShow.getState()).toMatchObject({
      openItemId: 'song-morning',
      selectedTile: 3,
    });
  });

  it('outputs the first tile of another open item with next', () => {
    setLive('song-morning', 2);
    openItem('song-river');
    outputNext();
    expect(sent[0]).toMatchObject({
      slide: {itemId: 'song-river', position: 0},
    });
  });

  it('outputs the tile before the live one with previous', () => {
    setLive('song-morning', 2);
    outputPrevious();
    expect(sent[0]).toMatchObject({
      slide: {itemId: 'song-morning', position: 1},
    });
  });

  it('does nothing with previous on the first tile or without a live 장', () => {
    outputPrevious();
    setLive('song-morning', 0);
    outputPrevious();
    expect(sent).toHaveLength(0);
  });
});

describe('item keys', () => {
  it('opens the next item that can output without outputting, and selects its first tile', () => {
    openItem('song-river');
    useShow.setState({selectedTile: 2});
    openNextItem();
    expect(useShow.getState()).toMatchObject({
      openItemId: 'psalm-23',
      selectedTile: 0,
    });
    expect(sent).toHaveLength(0);
  });

  it('skips empty sections', () => {
    openItem('psalm-23');
    openNextItem();
    expect(useShow.getState().openItemId).toBe('notice-sunday');
  });

  it('opens the previous item and stays at the first one', () => {
    openItem('song-river');
    openPreviousItem();
    expect(useShow.getState().openItemId).toBe('song-morning');
    openItem('countdown');
    openPreviousItem();
    expect(useShow.getState().openItemId).toBe('countdown');
    expect(sent).toHaveLength(0);
  });

  it('stays on the last item with next', () => {
    openItem('notice-sunday');
    openNextItem();
    expect(useShow.getState().openItemId).toBe('notice-sunday');
  });

  it('opens the first item with next when nothing is open, and nothing with previous', () => {
    openPreviousItem();
    expect(useShow.getState().openItemId).toBeNull();
    openNextItem();
    expect(useShow.getState().openItemId).toBe('countdown');
  });

  it('opens the item of the live 장 after another item was looked at', () => {
    setLive('song-morning', 2);
    openItem('song-river');
    revealLiveItem();
    expect(useShow.getState()).toMatchObject({
      openItemId: 'song-morning',
      selectedTile: 0,
    });
    expect(sent).toHaveLength(0);
  });

  it('keeps the selected tile when the live item is already open', () => {
    setLive('song-morning', 2);
    openItem('song-morning');
    useShow.setState({selectedTile: 3});
    revealLiveItem();
    expect(useShow.getState().selectedTile).toBe(3);
  });

  it('does nothing without a live 장', () => {
    openItem('song-river');
    revealLiveItem();
    expect(useShow.getState().openItemId).toBe('song-river');
  });
});

describe('slide hotkeys', () => {
  beforeEach(() => {
    const tiles = useShow.getState().tiles;
    const morningTiles = tiles['song-morning'] ?? [];
    useShow.setState({
      tiles: {
        ...tiles,
        'song-morning': morningTiles.map((tile, i) => {
          if (i === 0) {
            return {
              ...tile,
              hotKey: 'KeyA',
              sourceSlide: {
                songId: createSongId('30000000-0000-4000-8000-000000000001'),
                groupId: createSongGroupId(
                  'a0000000-0000-4000-8000-000000000001',
                ),
                slideIndex: 0,
              },
            };
          }
          if (i === 1) {
            return {
              ...tile,
              hotKey: 'Digit1',
              sourceSlide: {
                songId: createSongId('30000000-0000-4000-8000-000000000001'),
                groupId: createSongGroupId(
                  'a0000000-0000-4000-8000-000000000001',
                ),
                slideIndex: 1,
              },
            };
          }
          return tile;
        }),
      },
    });
  });

  it('detects whether active presentation has a matching slide hot key', () => {
    openItem('song-morning');
    expect(hasSlideHotKey('KeyA')).toBe(true);
    expect(hasSlideHotKey('Digit1')).toBe(true);
    expect(hasSlideHotKey('KeyZ')).toBe(false);
  });

  it('outputs the tile for a matching hot key and updates selection', () => {
    openItem('song-morning');
    const result = outputHotKey('KeyA');
    expect(result).toBe(true);
    expect(sent).toEqual([
      {
        type: 'slide.show',
        slide: {
          itemId: 'song-morning',
          position: 0,
          label: '1절',
          lines: ['아침이 밝아 오네', '새로운 노래를 부르리'],
          next: {
            label: '후렴',
            lines: ['함께 불러요 함께 노래해요'],
          },
        },
      },
    ]);
    expect(useShow.getState().selectedTile).toBe(0);
  });

  it('returns false and outputs nothing for unmatched hot key', () => {
    openItem('song-morning');
    const result = outputHotKey('KeyZ');
    expect(result).toBe(false);
    expect(sent).toHaveLength(0);
  });

  it('uses the open item in view even when another item is live', () => {
    setLive('song-river', 0);
    openItem('song-morning');
    expect(hasSlideHotKey('KeyA')).toBe(true);
    const result = outputHotKey('KeyA');
    expect(result).toBe(true);
    expect(sent[0]).toMatchObject({
      type: 'slide.show',
      slide: {itemId: 'song-morning', position: 0},
    });
  });

  it('does nothing when the open item has no tile with the key while the live item has one', () => {
    setLive('song-morning', 0);
    openItem('song-river');
    expect(hasSlideHotKey('KeyA')).toBe(false);
    const result = outputHotKey('KeyA');
    expect(result).toBe(false);
    expect(sent).toHaveLength(0);
  });

  it('returns false when no item is open or live', () => {
    useShow.setState({openItemId: null});
    expect(hasSlideHotKey('KeyA')).toBe(false);
    expect(outputHotKey('KeyA')).toBe(false);
    expect(sent).toHaveLength(0);
  });
});
