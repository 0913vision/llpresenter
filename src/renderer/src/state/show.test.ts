import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {LiveCommand} from '@shared/commands';
import {emptyLiveState, type LiveState} from '@shared/live';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {useLive} from './live';
import {
  jumpLabelFor,
  moveRow,
  moveTile,
  openNextItem,
  openPreviousItem,
  revealLiveItem,
  openItem,
  outputLabel,
  outputNext,
  outputPrevious,
  outputTile,
  useShow,
} from './show';
import {seedSampleService} from '@renderer/show/testing/sampleService';

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

  it('moves the open item with the row keys and skips headers', () => {
    moveRow('home');
    expect(useShow.getState().openItemId).toBe('countdown');
    moveRow('down');
    expect(useShow.getState().openItemId).toBe('song-morning');
    moveRow('end');
    expect(useShow.getState().openItemId).toBe('notice-sunday');
  });

  it('moves the selected tile inside the open item', () => {
    openItem('song-morning');
    moveTile('down', 2);
    expect(useShow.getState().selectedTile).toBe(2);
    moveTile('down', 2);
    expect(useShow.getState().selectedTile).toBe(2);
    moveTile('up', 2);
    expect(useShow.getState().selectedTile).toBe(0);
  });

  it('ignores tile keys when no item is open', () => {
    moveTile('down', 2);
    expect(useShow.getState().selectedTile).toBe(0);
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

  it('outputs an 이름표 after the live 장 and goes back to the first when none follows', () => {
    openItem('song-morning');
    setLive('song-morning', 0);
    outputLabel('후렴');
    expect(sent[0]).toMatchObject({slide: {position: 1, label: '후렴'}});
    setLive('song-morning', 3);
    outputLabel('후렴');
    expect(sent[1]).toMatchObject({slide: {position: 1, label: '후렴'}});
  });

  it('sends nothing for an 이름표 the item does not have', () => {
    openItem('song-morning');
    outputLabel('브리지');
    expect(sent).toHaveLength(0);
  });

  it('knows the 이름표 of a jump key by its physical key', () => {
    expect(jumpLabelFor('KeyC')).toBe('후렴');
    expect(jumpLabelFor('KeyZ')).toBeUndefined();
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

  it('skips headers and the empty slot', () => {
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
