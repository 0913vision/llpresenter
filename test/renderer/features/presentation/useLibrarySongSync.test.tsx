import {lyricsSlide} from '@fixtures/core/slides';
import {act, renderHook, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {createSongId} from '@core/schema/ids';
import type {ShowLibrarySong} from '@core/schema/showLibrarySong';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {sampleService} from '@fixtures/renderer/session/sampleService';
import {useLibrarySongSync} from '@renderer/features/presentation/useLibrarySongSync';
import {applyService, useShow} from '@renderer/session/show';
import {openLibrarySong} from '@renderer/session/showLibrary';

const songId = createSongId('10000000-0000-4000-8000-000000000001');

function song(overrides: Partial<ShowLibrarySong> = {}): ShowLibrarySong {
  return {
    songId,
    songRevision: 1,
    title: '새벽의 빛',
    readOnly: false,
    tiles: [
      {
        slide: lyricsSlide(3, ['창작한 첫 줄']),
        auto: {},
        caption: '1절',
        labelColor: '#5FB8C2',
      },
      {
        slide: lyricsSlide(4, ['창작한 두 번째 줄']),
        auto: {},
        caption: '후렴',
        labelColor: '#D68F5F',
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  useShow.setState({librarySong: null});
  applyService(null);
  applyService(sampleService);
});
afterEach(() => {
  useShow.setState({librarySong: null});
  applyService(null);
  delete window.llp;
});

describe('useLibrarySongSync', () => {
  it('refreshes on document feeds, ignores stale responses, and releases all subscriptions', async () => {
    const showSong = vi.fn(async () => song());
    const api = mockLlpApi({library: {showSong}});
    window.llp = api;
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
});
