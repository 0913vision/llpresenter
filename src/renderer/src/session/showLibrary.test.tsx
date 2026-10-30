import {
  act,
  cleanup,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import type {LiveCommand} from '@core/live/commands';
import {emptyLiveState} from '@core/live/state';
import {createMediaId, createSongId} from '@core/schema/ids';
import type {ShowLibrarySong} from '@core/schema/showLibrarySong';
import {fakeLlpApi} from '@contracts/ipc/testing/fakeLlpApi';
import {
  SlidePanelBody,
  SlidePanelMeta,
} from '@renderer/features/presentation/SlidePanel';
import {useLibrarySongSync} from '@renderer/features/presentation/useLibrarySongSync';
import {sampleService} from '@renderer/session/testing/sampleService';
import {useLive} from './live';
import {applyService, openItem, outputTile, selectTile, useShow} from './show';
import {
  librarySourceId,
  openLibrarySong,
  refreshLibrarySong,
} from './showLibrary';

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
  const api = fakeLlpApi({live: {send}, library: {showSong}});
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

it('opens a separate library source in the real slide panel without changing service rows or output', () => {
  const {send} = setup();
  const before = useShow.getState();
  openLibrarySong(song());
  render(
    <>
      <SlidePanelMeta />
      <SlidePanelBody sizeClass="normal" />
    </>,
  );
  expect(screen.getByText('새벽의 빛')).toBeDefined();
  expect(screen.getByText('슬라이드 2개')).toBeDefined();
  expect(screen.getByText('창작한 첫 줄')).toBeDefined();
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
  render(<SlidePanelBody sizeClass="normal" />);
  await userEvent.click(screen.getByRole('option', {name: /창작한 첫 줄/}));
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

it.each([
  {
    source: song({readOnly: true}),
    reason: '새 버전의 파일이라 읽기 전용으로 엽니다.',
  },
  {
    source: song({problem: 'missing-background'}),
    reason: '배경 파일을 찾을 수 없음',
  },
])('shows the library source problem: $reason', ({source, reason}) => {
  setup();
  openLibrarySong(source);
  render(<SlidePanelMeta />);
  expect(screen.getByRole('img', {name: reason})).toBeDefined();
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

it('refreshes on document feeds, ignores stale responses, and releases all subscriptions', async () => {
  const {api, showSong} = setup();
  const stops = [vi.fn(), vi.fn(), vi.fn()];
  let songChanged = (): void => undefined;
  let mediaChanged = (): void => undefined;
  vi.spyOn(api.songs, 'subscribe').mockImplementation(listener => {
    songChanged = () => listener({songId, document: null});
    return stops[0] ?? (() => undefined);
  });
  vi.spyOn(api.settings, 'subscribe').mockReturnValue(
    stops[1] ?? (() => undefined),
  );
  const media = await api.media.get();
  vi.spyOn(api.media, 'subscribe').mockImplementation(listener => {
    mediaChanged = () => listener(media);
    return stops[2] ?? (() => undefined);
  });
  openLibrarySong(song());
  const {unmount} = renderHook(() => useLibrarySongSync(vi.fn()));
  await waitFor(() => expect(showSong).toHaveResolvedTimes(1));
  let older: (value: ShowLibrarySong) => void = () => undefined;
  showSong.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        older = resolve;
      }),
  );
  act(songChanged);
  showSong.mockResolvedValueOnce(song({songRevision: 3, title: '최신 제목'}));
  act(mediaChanged);
  await waitFor(() =>
    expect(useShow.getState().librarySong?.title).toBe('최신 제목'),
  );
  older(song({songRevision: 2}));
  await waitFor(() => expect(showSong).toHaveResolvedTimes(3));
  expect(useShow.getState().librarySong?.songRevision).toBe(3);
  unmount();
  for (const stop of stops) expect(stop).toHaveBeenCalledOnce();
  act(songChanged);
  expect(showSong).toHaveBeenCalledTimes(3);
});
