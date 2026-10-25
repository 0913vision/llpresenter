import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {Channels} from '@shared/ipc';
import {createSongId} from '@shared/schema/ids';
import {parseSongDocument} from '@shared/schema/contentDocuments';
import type {Logger} from '../log';
import {
  registerLibrarySong,
  showLibrarySong,
  type LibrarySongSources,
} from './librarySong';

const songId = createSongId('10000000-0000-4000-8000-000000000001');
type Handler = (event: unknown, value: unknown) => Promise<unknown>;
const ipc = vi.hoisted(() => ({handlers: new Map<string, Handler>()}));
vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: Handler) =>
      ipc.handlers.set(channel, handler),
    removeHandler: (channel: string) => ipc.handlers.delete(channel),
  },
}));

function sources(overrides: object = {}) {
  const parsed = parseSongDocument({
    song: {
      format: 'llsong',
      schemaVersion: 1,
      id: songId,
      title: 'Invented song',
      slides: [{label: 'Verse', lines: ['First']}, {lines: ['Second']}],
      arrangements: [{name: 'Alternate', slides: [2, 1, 2]}],
    },
    revision: 3,
    access: 'editable',
    ...overrides,
  });
  if (!parsed.ok || parsed.value === null) throw new Error('Invalid fixture');
  return {
    song: vi.fn(() => parsed.value),
    labels: [
      {name: 'Verse', color: 'teal', key: 'Digit1'},
      {name: 'Later', color: 'rose', key: 'Digit1'},
    ],
    backgroundOf: vi.fn(() => Promise.resolve(null)),
  } satisfies LibrarySongSources;
}

function registered(ready: Promise<LibrarySongSources | null>) {
  const log = {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    flush: async () => undefined,
  } satisfies Logger;
  const release = registerLibrarySong(ready, log);
  onTestFinished(release);
  const handler = ipc.handlers.get(Channels.libraryShowSong);
  if (handler === undefined) throw new Error('Handler missing');
  return {log, release, ask: (value: unknown) => handler({}, value)};
}

describe('library song projection', () => {
  it('uses file order, current label colors and first jump keys without a service item', async () => {
    const source = sources();
    expect(await showLibrarySong(source, songId)).toEqual({
      songId,
      songRevision: 3,
      title: 'Invented song',
      readOnly: false,
      tiles: [
        {label: 'Verse', labelColor: 'teal', lines: ['First']},
        {label: null, labelColor: 'none', lines: ['Second']},
      ],
      jumpKeys: {Digit1: 'Verse'},
    });
    expect(source.backgroundOf).not.toHaveBeenCalled();
    const next = {
      ...source,
      labels: [{name: 'Verse', color: 'rose', key: null}] as const,
    };
    expect(await showLibrarySong(next, songId)).toMatchObject({
      tiles: [{labelColor: 'rose'}, {}],
      jumpKeys: {},
    });
  });

  it('keeps known fields read-only from a newer file', async () => {
    expect(
      await showLibrarySong(sources({access: 'readOnly'}), songId),
    ).toMatchObject({readOnly: true, problem: 'newer-version'});
  });

  it('returns null for a missing or deleted song', async () => {
    expect(
      await showLibrarySong({...sources(), song: () => null}, songId),
    ).toBeNull();
  });

  it('waits for load, validates requests, and removes its handler on release', async () => {
    let loaded: (value: LibrarySongSources) => void = () => undefined;
    const ready = new Promise<LibrarySongSources>(resolve => {
      loaded = resolve;
    });
    const {ask, release, log} = registered(ready);
    await expect(ask({songId: 'bad'})).rejects.toThrow(
      'Invalid library song request',
    );
    expect(log.warn).toHaveBeenCalledOnce();
    const pending = ask({songId});
    loaded(sources());
    expect(await pending).toMatchObject({songId, songRevision: 3});
    release();
    expect(ipc.handlers.has(Channels.libraryShowSong)).toBe(false);
    expect(await ask({songId})).toBeNull();
  });

  it('logs and rejects failed reads and unavailable storage', async () => {
    const broken = registered(
      Promise.resolve({
        ...sources(),
        song: () => {
          throw new Error('Read failed');
        },
      }),
    );
    await expect(broken.ask({songId})).rejects.toThrow(
      'Could not show a library song',
    );
    expect(broken.log.error).toHaveBeenCalledOnce();
    const missing = registered(Promise.resolve(null));
    await expect(missing.ask({songId})).rejects.toThrow(
      'Could not show a library song',
    );
    expect(missing.log.error).toHaveBeenCalledOnce();
  });

  it('does not publish a response when released during initial load', async () => {
    let loaded: (value: LibrarySongSources) => void = () => undefined;
    const ready = new Promise<LibrarySongSources>(resolve => {
      loaded = resolve;
    });
    const {ask, release} = registered(ready);
    const pending = ask({songId});
    release();
    const source = sources();
    loaded(source);
    expect(await pending).toBeNull();
    expect(source.song).not.toHaveBeenCalled();
  });

  it('drops a projection released while a background check is pending', async () => {
    const document = sources().song();
    if (document === null) throw new Error('Missing song');
    const source = sources({song: {...document.song, background: songId}});
    let finish: (value: null) => void = () => undefined;
    source.backgroundOf.mockImplementation(
      () =>
        new Promise<null>(resolve => {
          finish = resolve;
        }),
    );
    const {ask, release} = registered(Promise.resolve(source));
    const pending = ask({songId});
    await vi.waitFor(() => expect(source.backgroundOf).toHaveBeenCalledOnce());
    release();
    finish(null);
    expect(await pending).toBeNull();
  });
});
