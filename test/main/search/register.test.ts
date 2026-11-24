import {afterEach, describe, expect, it, vi} from 'vitest';
import {libraryEndpoints} from '@contracts/ipc/library';
import type {SongChange} from '@core/schema/services/contentDocuments';
import {createSongId} from '@core/schema/common/ids';
import {LIBRARY_SEARCH_LIMITS} from '@core/schema/songs/librarySearch';
import type {Song} from '@core/schema/songs/song';
import {lyricsSlide} from '@fixtures/core/slides';
import type {Logger} from '@main/base/log';
import {registerLibrarySearch, type SongSource} from '@main/search/register';
import {SongSearchIndex} from '@main/search/songIndex';

function song(number: number, title: string, lines: readonly string[]): Song {
  return {
    format: 'llsong',
    schemaVersion: 1,
    id: createSongId(
      `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`,
    ),
    title,
    slides: [lyricsSlide(1, lines)],
  };
}

function sourceOf(songs: readonly Song[] = []) {
  const listeners = new Set<(change: SongChange) => void>();
  return {
    songs: () => songs,
    subscribeSongs: (listener: (change: SongChange) => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    /** A song was created, edited, or deleted. */
    change: (changed: Song, isDeleted = false) => {
      for (const listener of listeners) {
        listener({
          songId: changed.id,
          document: isDeleted
            ? null
            : {song: changed, revision: 2, access: 'editable'},
        });
      }
    },
    listeners,
  };
}

const ipc = await vi.hoisted(async () =>
  (await import('@fixtures/main/base/mockIpcMain')).mockIpcMain(),
);
vi.mock('electron', () => ({ipcMain: ipc.ipcMain}));
const stops: Array<() => void> = [];
function log(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    flush: async () => undefined,
  };
}
function register(ready: Promise<SongSource | null>, logger = log()) {
  const stop = registerLibrarySearch(ready, logger);
  stops.push(stop);
  return {
    ask: (value: unknown) => ipc.invoke(libraryEndpoints.search, value),
    stop,
    logger,
  };
}
afterEach(() => stops.splice(0).forEach(stop => stop()));

describe('registerLibrarySearch', () => {
  const dawn = song(1, '새벽의 길', ['돌아온 아침빛']);

  it('waits for the songs and answers with the search of them', async () => {
    let finish: (value: SongSource) => void = () => undefined;
    const ready = new Promise<SongSource>(resolve => {
      finish = resolve;
    });
    const {ask} = register(ready);
    let completed = false;
    const answer = ask({query: ' ㅅㅂ '}).then(value => {
      completed = true;
      return value;
    });
    await Promise.resolve();
    expect(completed).toBe(false);
    finish(sourceOf([dawn]));
    await expect(answer).resolves.toMatchObject({
      query: ' ㅅㅂ ',
      matches: [{songId: dawn.id, match: {kind: 'title'}}],
    });
  });

  it('follows edits, deletion, and creation, also while it reads the songs', async () => {
    const source = sourceOf([dawn]);
    const {ask, stop} = register(Promise.resolve(source));
    await vi.waitFor(() => expect(source.listeners.size).toBe(1));
    const edited = song(1, '바람의 노래', ['다시 피어난 햇살']);
    source.change(edited);
    expect(await ask({query: '햇살'})).toMatchObject({
      matches: [{title: '바람의 노래'}],
    });
    expect(await ask({query: '아침빛'})).toMatchObject({matches: []});
    source.change(song(2, '새 곡', []));
    expect(await ask({query: '새곡'})).toMatchObject({
      matches: [{title: '새 곡'}],
    });
    source.change(edited, true);
    expect(await ask({query: '햇살'})).toMatchObject({matches: []});
    stop();
    expect(source.listeners.size).toBe(0);
  });

  it('passes the shared default and maximum through the IPC boundary', async () => {
    const search = vi.spyOn(SongSearchIndex.prototype, 'search');
    const {ask} = register(Promise.resolve(sourceOf()));
    await ask({query: ''});
    expect(search).toHaveBeenLastCalledWith({
      query: '',
      limit: LIBRARY_SEARCH_LIMITS.default,
    });
    await ask({query: '', limit: LIBRARY_SEARCH_LIMITS.max});
    expect(search).toHaveBeenLastCalledWith({
      query: '',
      limit: LIBRARY_SEARCH_LIMITS.max,
    });
    search.mockRestore();
  });

  it.each([
    null,
    {},
    {query: 1},
    {query: 'x', limit: 0},
    {query: 'x', limit: 1.5},
    {query: 'x', limit: LIBRARY_SEARCH_LIMITS.max + 1},
  ])('rejects and logs malformed request %j', async value => {
    const {ask, logger} = register(Promise.resolve(sourceOf()));
    await expect(ask(value)).rejects.toThrow(
      'Malformed library:search request',
    );
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('returns empty results when the store is unavailable', async () => {
    const {ask} = register(Promise.resolve(null));
    await expect(ask({query: 'song'})).resolves.toEqual({
      query: 'song',
      matches: [],
    });
  });

  it('removes the handler and ignores songs that come after disposal', async () => {
    let finish: (value: SongSource) => void = () => undefined;
    const ready = new Promise<SongSource>(resolve => {
      finish = resolve;
    });
    const {ask, stop} = register(ready);
    const answer = ask({query: ''});
    stop();
    expect(ipc.has(libraryEndpoints.search.channel)).toBe(false);
    const source = sourceOf([dawn]);
    finish(source);
    await expect(answer).resolves.toEqual({query: '', matches: []});
    expect(source.listeners.size).toBe(0);
  });

  it('logs unexpected search failures and rejects without stopping other work', async () => {
    const search = vi
      .spyOn(SongSearchIndex.prototype, 'search')
      .mockImplementationOnce(() => {
        throw new Error('Search failed');
      });
    const {ask, logger} = register(Promise.resolve(sourceOf()));
    await expect(ask({query: 'song'})).rejects.toThrow(
      'Could not search the song library',
    );
    expect(logger.error).toHaveBeenCalledTimes(1);
    await expect(ask({query: 'song'})).resolves.toEqual({
      query: 'song',
      matches: [],
    });
    search.mockRestore();
  });
});
