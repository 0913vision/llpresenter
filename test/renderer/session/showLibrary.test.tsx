import {act, cleanup, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import type {LiveCommand} from '@core/live/commands';
import {emptyLiveState} from '@core/live/state';
import {createMediaId, createSongId} from '@core/schema/ids';
import type {ShowLibrarySong} from '@core/schema/showLibrarySong';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {sampleService} from '@fixtures/renderer/session/sampleService';
import {useLive} from '@renderer/session/live';
import {
  applyService,
  openItem,
  outputTile,
  selectTile,
  useShow,
} from '@renderer/session/show';
import {
  librarySourceId,
  openLibrarySong,
  refreshLibrarySong,
} from '@renderer/session/showLibrary';

const songId = createSongId('10000000-0000-4000-8000-000000000001');
const mediaId = createMediaId('30000000-0000-4000-8000-000000000001');
const itemId = librarySourceId(songId);

function song(overrides: Partial<ShowLibrarySong> = {}): ShowLibrarySong {
  return {
    songId,
    songRevision: 1,
    title: '새벽의 빛',
    readOnly: false,
    tiles: [
      {label: '1절', labelColor: 'teal', lines: ['창작한 첫 줄']},
      {label: '후렴', labelColor: 'orange', lines: ['창작한 두 번째 줄']},
    ],
    jumpKeys: {KeyC: '후렴'},
    background: {mediaId, loop: true},
    ...overrides,
  };
}

function setup() {
  const send = vi.fn<(command: LiveCommand) => void>();
  const showSong = vi.fn(async () => song());
  const api = mockLlpApi({live: {send}, library: {showSong}});
  window.llp = api;
  return {api, send, showSong};
}

beforeEach(() => {
  useShow.setState({librarySong: null});
  applyService(null);
  applyService(sampleService);
  useLive.setState({
    state: emptyLiveState(),
    lastSlideItemId: null,
    commandVersion: 0,
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  useShow.setState({librarySong: null});
  applyService(null);
  delete window.llp;
});

it('opens a separate library source without changing service rows or output', () => {
  const {send} = setup();
  const before = useShow.getState();
  openLibrarySong(song());
  expect(useShow.getState()).toMatchObject({
    openItemId: itemId,
    selectedTile: 0,
  });
  expect(useShow.getState().rows).toBe(before.rows);
  expect(useShow.getState().tiles).toBe(before.tiles);
  expect(useShow.getState().serviceId).toBe(before.serviceId);
  expect(send).not.toHaveBeenCalled();
});

it('refreshes the source and outputs its background before lyrics without item.start', async () => {
  const {send, showSong} = setup();
  openLibrarySong(song());
  act(() => outputTile({itemId, index: 0}));
  await waitFor(() => expect(send).toHaveBeenCalledTimes(2));
  expect(showSong).toHaveBeenCalledExactlyOnceWith({songId});
  expect(send.mock.calls.map(call => call[0])).toEqual([
    {type: 'media.show', media: {mediaId, loop: true}},
    {
      type: 'slide.show',
      slide: {
        itemId,
        position: 0,
        label: '1절',
        lines: ['창작한 첫 줄'],
        next: {label: '후렴', lines: ['창작한 두 번째 줄']},
      },
    },
  ]);
});

it('validates a refreshed tile before changing either the background or lyrics', async () => {
  const {send, showSong} = setup();
  let finish: (value: ShowLibrarySong) => void = () => undefined;
  showSong.mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  openLibrarySong(song());
  outputTile({itemId, index: 1});
  finish(
    song({
      songRevision: 2,
      tiles: [song().tiles[0]].filter(tile => tile !== undefined),
    }),
  );
  await waitFor(() =>
    expect(useShow.getState().librarySong?.songRevision).toBe(2),
  );
  expect(send).not.toHaveBeenCalled();
});

it('drops a pending library output after another source outputs', async () => {
  const {send, showSong} = setup();
  let finish: (value: ShowLibrarySong) => void = () => undefined;
  showSong.mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  openLibrarySong(song());
  outputTile({itemId, index: 0});
  outputTile({itemId: 'song-morning', index: 0});
  finish(song());
  await waitFor(() => expect(showSong).toHaveResolved());
  expect(send).toHaveBeenCalledExactlyOnceWith({
    type: 'slide.show',
    slide: {
      itemId: 'song-morning',
      position: 0,
      label: '1절',
      lines: sampleService.tiles['song-morning']?.[0]?.lines,
      next: {
        label: sampleService.tiles['song-morning']?.[1]?.label,
        lines: sampleService.tiles['song-morning']?.[1]?.lines,
      },
    },
  });
});

it('preserves the selected library source through service pushes and clamps refreshed selection', () => {
  setup();
  openLibrarySong(song());
  selectTile(1);
  applyService({...sampleService, revision: 2, rows: []});
  applyService(null);
  expect(useShow.getState()).toMatchObject({
    openItemId: itemId,
    selectedTile: 1,
  });
  refreshLibrarySong(songId, song({songRevision: 3, tiles: []}));
  refreshLibrarySong(songId, song({songRevision: 2}));
  expect(useShow.getState()).toMatchObject({
    selectedTile: 0,
    librarySong: {songRevision: 3, tiles: []},
  });
  openItem('another-source');
  refreshLibrarySong(songId, null);
  expect(useShow.getState()).toMatchObject({
    openItemId: 'another-source',
    librarySong: null,
  });
});

it('does not output a source whose fresh read confirms deletion', async () => {
  const {api, send} = setup();
  vi.spyOn(api.library, 'showSong').mockResolvedValueOnce(null);
  openLibrarySong(song());
  outputTile({itemId, index: 0});
  await waitFor(() => expect(useShow.getState().librarySong).toBeNull());
  expect(send).not.toHaveBeenCalled();
});

it.each(['failure', 'timeout'] as const)(
  'outputs the latest retained tile and keeps media on lookup %s',
  async mode => {
    vi.useFakeTimers();
    const {api, send, showSong} = setup();
    const log = vi.spyOn(api.log, 'write');
    let fail: (cause: Error) => void = () => undefined;
    let finish: (value: ShowLibrarySong) => void = () => undefined;
    showSong.mockImplementationOnce(
      () =>
        new Promise((resolve, reject) => {
          finish = resolve;
          fail = reject;
        }),
    );
    openLibrarySong(song());
    outputTile({itemId, index: 0});
    refreshLibrarySong(
      songId,
      song({
        songRevision: 2,
        tiles: [
          {label: '후렴', labelColor: 'orange', lines: ['갱신된 창작 가사']},
        ],
      }),
    );
    if (mode === 'failure') {
      fail(new Error('Invented read failure'));
      await vi.advanceTimersByTimeAsync(0);
    } else {
      await vi.advanceTimersByTimeAsync(1999);
      expect(send).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
    }
    expect(send).toHaveBeenCalledExactlyOnceWith({
      type: 'slide.show',
      slide: {itemId, position: 0, label: '후렴', lines: ['갱신된 창작 가사']},
    });
    expect(log).toHaveBeenCalledWith(expect.objectContaining({level: 'warn'}));
    expect(vi.getTimerCount()).toBe(0);
    finish(song({songRevision: 3}));
    await vi.advanceTimersByTimeAsync(0);
    expect(send).toHaveBeenCalledTimes(1);
    expect(useShow.getState().librarySong?.songRevision).toBe(2);
  },
);

it.each(['failure', 'timeout'] as const)(
  'drops the cached fallback after a newer output on lookup %s',
  async mode => {
    vi.useFakeTimers();
    const {send, showSong} = setup();
    let fail: (cause: Error) => void = () => undefined;
    showSong.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          fail = reject;
        }),
    );
    openLibrarySong(song());
    outputTile({itemId, index: 0});
    outputTile({itemId: 'song-morning', index: 0});
    if (mode === 'failure') {
      fail(new Error('Invented read failure'));
      await vi.advanceTimersByTimeAsync(0);
    } else {
      await vi.advanceTimersByTimeAsync(2000);
    }
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0]).toMatchObject({
      type: 'slide.show',
      slide: {itemId: 'song-morning'},
    });
    expect(vi.getTimerCount()).toBe(0);
  },
);

it('does not output a cached tile removed while a failing lookup was pending', async () => {
  vi.useFakeTimers();
  const {send, showSong} = setup();
  let fail: (cause: Error) => void = () => undefined;
  showSong.mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        fail = reject;
      }),
  );
  openLibrarySong(song());
  outputTile({itemId, index: 1});
  refreshLibrarySong(songId, song({songRevision: 2, tiles: []}));
  fail(new Error('Invented read failure'));
  await vi.advanceTimersByTimeAsync(0);
  expect(send).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

it('uses a newer retained tile without applying an older lookup background', async () => {
  const {send, showSong} = setup();
  let finish: (value: ShowLibrarySong) => void = () => undefined;
  showSong.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  openLibrarySong(song());
  outputTile({itemId, index: 0});
  refreshLibrarySong(
    songId,
    song({
      songRevision: 2,
      tiles: [{label: null, labelColor: 'none', lines: ['최신 창작 가사']}],
    }),
  );
  finish(song());
  await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
  expect(send).toHaveBeenCalledExactlyOnceWith({
    type: 'slide.show',
    slide: {itemId, position: 0, label: null, lines: ['최신 창작 가사']},
  });
  expect(useShow.getState().librarySong?.songRevision).toBe(2);
});
