import {expect, it, vi} from 'vitest';
import {createSongId} from '@core/schema/common/ids';
import type {ShowLibrarySong} from '@core/schema/songs/showLibrarySong';
import {
  readLibrarySong,
  SONG_LOAD_FAILED,
} from '@renderer/features/songs/library/readLibrarySong';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';

const SONG_ID = createSongId('00000000-0000-4000-8000-000000000101');

function setup(showSong: () => Promise<ShowLibrarySong | null>) {
  const write = vi.fn();
  const api = mockLlpApi({library: {showSong}, log: {write}});
  return {api, write, report: vi.fn()};
}

it('answers the song, or null when the 라이브러리 has none, without a card', async () => {
  const song: ShowLibrarySong = {
    songId: SONG_ID,
    songRevision: 2,
    title: '만복의 근원 하나님',
    readOnly: false,
    tiles: [],
  };
  const found = setup(async () => song);
  expect(
    await readLibrarySong(found.api, SONG_ID, {key: 'k', report: found.report}),
  ).toBe(song);
  const missing = setup(async () => null);
  expect(
    await readLibrarySong(missing.api, SONG_ID, {
      key: 'k',
      report: missing.report,
    }),
  ).toBeNull();
  expect(found.report).not.toHaveBeenCalled();
  expect(missing.report).not.toHaveBeenCalled();
});

it('logs why a song could not be read and shows one card under its key', async () => {
  const failing = setup(() => Promise.reject(new Error('main is busy')));
  expect(
    await readLibrarySong(failing.api, SONG_ID, {
      key: 'details:library',
      report: failing.report,
    }),
  ).toBeUndefined();
  expect(failing.write).toHaveBeenCalledWith(
    expect.objectContaining({
      message: `Could not show library song ${SONG_ID}`,
    }),
  );
  expect(failing.report).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({key: 'details:library', title: SONG_LOAD_FAILED}),
  );
});

it('only logs a failure whose answer is no longer wanted', async () => {
  const failing = setup(() => Promise.reject(new Error('main is busy')));
  await readLibrarySong(failing.api, SONG_ID, {
    key: 'details:library',
    report: failing.report,
    wanted: () => false,
  });
  expect(failing.write).toHaveBeenCalled();
  expect(failing.report).not.toHaveBeenCalled();
});
