import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {LiveCommand} from '@shared/commands';
import {emptyLiveState, type LiveState} from '@shared/live';
import type {LlpApi} from '@shared/ipc';
import {useLive} from './live';
import {
  moveRow,
  moveTile,
  openItem,
  outputNext,
  outputPrevious,
  outputTile,
  useShow,
} from './show';

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
    moveTile('right', 3);
    expect(useShow.getState().selectedTile).toBe(1);
    moveTile('down', 3);
    expect(useShow.getState().selectedTile).toBe(1);
    moveTile('left', 3);
    moveTile('left', 3);
    expect(useShow.getState().selectedTile).toBe(0);
  });

  it('ignores tile keys when no item is open', () => {
    moveTile('right', 3);
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

  it('goes on to the next item after the last tile', () => {
    setLive('song-morning', 3);
    outputNext();
    expect(sent[0]).toMatchObject({slide: {itemId: 'song-river', position: 0}});
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
