import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {libraryEndpoints} from '@contracts/ipc/library';
import {LIBRARY_SEARCH_LIMITS} from '@core/schema/librarySearch';
import type {Logger} from '@main/log';
import {registerLibrarySearch} from '@main/search/register';
import type {SongSearchIndex} from '@main/search/songIndex';

type Index = Pick<SongSearchIndex, 'search'>;

function mockIndex() {
  return {
    search: vi.fn<Index['search']>(request => ({
      query: request.query,
      matches: [],
    })),
  };
}

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
function register(ready: Promise<Index | null>, logger = log()) {
  const stop = registerLibrarySearch(ready, logger);
  stops.push(stop);
  const handler = electron.handlers.get(libraryEndpoints.search.channel);
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
  it('waits for the index and answers with its search', async () => {
    let finish: (value: Index) => void = () => undefined;
    const ready = new Promise<Index>(resolve => {
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
    const index = mockIndex();
    finish(index);
    await expect(answer).resolves.toEqual({query: ' ㅁㅂㅇ ', matches: []});
    expect(index.search).toHaveBeenCalledWith(
      expect.objectContaining({query: ' ㅁㅂㅇ '}),
    );
  });

  it('passes the shared default and maximum through the IPC boundary', async () => {
    const index = mockIndex();
    const {search} = index;
    const {ask} = register(Promise.resolve(index));
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
  });

  it.each([
    null,
    {},
    {query: 1},
    {query: 'x', limit: 0},
    {query: 'x', limit: 1.5},
    {query: 'x', limit: LIBRARY_SEARCH_LIMITS.max + 1},
  ])('rejects and logs malformed request %j', async value => {
    const {ask, logger} = register(Promise.resolve(mockIndex()));
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
    let finish: (value: Index) => void = () => undefined;
    const ready = new Promise<Index>(resolve => {
      finish = resolve;
    });
    const {ask, stop} = register(ready);
    const answer = ask({query: ''});
    stop();
    expect(electron.handlers.has(libraryEndpoints.search.channel)).toBe(false);
    const index = mockIndex();
    finish(index);
    await expect(answer).resolves.toEqual({query: '', matches: []});
    expect(index.search).not.toHaveBeenCalled();
  });

  it('logs unexpected search failures and rejects without stopping other work', async () => {
    const index = mockIndex();
    index.search.mockImplementationOnce(() => {
      throw new Error('Search failed');
    });
    const {ask, logger} = register(Promise.resolve(index));
    await expect(ask({query: 'song'})).rejects.toThrow(
      'Could not search the song library',
    );
    expect(logger.error).toHaveBeenCalledTimes(1);
    await expect(ask({query: 'song'})).resolves.toEqual({
      query: 'song',
      matches: [],
    });
  });
});
