import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {Channels} from '@shared/ipc';
import {parseSong} from '@shared/schema/song';
import type {Logger} from '../log';
import {hymnOne} from '../store/testFiles';
import {registerLibrarySearch} from './register';
import {SongSearchIndex} from './songIndex';

type Handler = (event: unknown, value: unknown) => unknown;
const electron = vi.hoisted(() => ({handlers: new Map<string, Handler>()}));
vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: Handler) =>
      electron.handlers.set(channel, handler),
    removeHandler: (channel: string) => electron.handlers.delete(channel),
  },
}));
const stops: Array<() => void> = [];
function log(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    flush: async () => undefined,
  };
}
function register(ready: Promise<SongSearchIndex | null>, logger = log()) {
  const stop = registerLibrarySearch(ready, logger);
  stops.push(stop);
  const handler = electron.handlers.get(Channels.librarySearch);
  if (handler === undefined) throw new Error('Missing search handler');
  return {
    ask: (value: unknown) => Promise.resolve(handler({}, value)),
    stop,
    logger,
  };
}
beforeEach(() => electron.handlers.clear());
afterEach(() => stops.splice(0).forEach(stop => stop()));

describe('registerLibrarySearch', () => {
  it('waits for initial indexing and echoes the original query', async () => {
    let finish: (value: SongSearchIndex) => void = () => undefined;
    const ready = new Promise<SongSearchIndex>(resolve => {
      finish = resolve;
    });
    const {ask} = register(ready);
    let completed = false;
    const answer = ask({query: ' ㅁㅂㅇ '}).then(value => {
      completed = true;
      return value;
    });
    await Promise.resolve();
    expect(completed).toBe(false);
    const parsed = parseSong(JSON.stringify(hymnOne()), 'song.llsong');
    if (!parsed.ok) throw new Error('Invalid test song');
    const index = new SongSearchIndex();
    index.upsert(parsed.value.data);
    finish(index);
    await expect(answer).resolves.toMatchObject({
      query: ' ㅁㅂㅇ ',
      matches: [{title: '만복의 근원 하나님'}],
    });
  });

  it.each([
    null,
    {},
    {query: 1},
    {query: 'x', limit: 0},
    {query: 'x', limit: 1.5},
  ])('rejects and logs malformed request %j', async value => {
    const {ask, logger} = register(Promise.resolve(new SongSearchIndex()));
    await expect(ask(value)).rejects.toThrow('Invalid library search request');
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('returns empty results when the store is unavailable', async () => {
    const {ask} = register(Promise.resolve(null));
    await expect(ask({query: 'song'})).resolves.toEqual({
      query: 'song',
      matches: [],
    });
  });

  it('removes the handler and ignores a read that finishes after disposal', async () => {
    let finish: (value: SongSearchIndex) => void = () => undefined;
    const ready = new Promise<SongSearchIndex>(resolve => {
      finish = resolve;
    });
    const {ask, stop} = register(ready);
    const answer = ask({query: ''});
    stop();
    expect(electron.handlers.has(Channels.librarySearch)).toBe(false);
    const index = new SongSearchIndex();
    const search = vi.spyOn(index, 'search');
    finish(index);
    await expect(answer).resolves.toEqual({query: '', matches: []});
    expect(search).not.toHaveBeenCalled();
  });

  it('logs unexpected search failures and rejects without stopping other work', async () => {
    const index = new SongSearchIndex();
    const search = vi.spyOn(index, 'search').mockImplementationOnce(() => {
      throw new Error('Search failed');
    });
    const {ask, logger} = register(Promise.resolve(index));
    await expect(ask({query: 'song'})).rejects.toThrow(
      'Could not search the song library',
    );
    expect(logger.error).toHaveBeenCalledTimes(1);
    search.mockRestore();
    await expect(ask({query: 'song'})).resolves.toEqual({
      query: 'song',
      matches: [],
    });
  });
});
