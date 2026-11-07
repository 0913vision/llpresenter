import {fixtureSlideId} from '@fixtures/core/songs/slideFixtures';
import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {libraryEndpoints} from '@contracts/ipc/library';
import {createSongId} from '@core/schema/ids';
import type {Song} from '@core/schema/song';
import {parseSongDocument} from '@core/schema/contentDocuments';
import type {Logger} from '@main/log';
import {
  registerLibrarySong,
  showLibrarySong,
  type LibrarySongSources,
} from '@main/store/librarySong';

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
      slides: [
        {id: fixtureSlideId(1), lines: ['First'], label: 'Verse'},
        {id: fixtureSlideId(2), lines: ['Second']},
      ],
    },
    revision: 3,
    access: 'editable',
    ...overrides,
  });
  if (!parsed.ok || parsed.value === null) throw new Error('Invalid fixture');
  return {
    song: vi.fn(() => parsed.value),
    labels: [
      {name: 'Verse', color: '#5FB8C2', key: 'Digit1'},
      {name: 'Later', color: '#D07A8A', key: 'Digit1'},
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
  const handler = ipc.handlers.get(libraryEndpoints.showSong.channel);
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
        {
          label: 'Verse',
          labelColor: '#5FB8C2',
          lines: ['First'],
          sourceSlide: {
            songId,
            slideId: fixtureSlideId(1),
          },
        },
        {
          label: null,
          labelColor: 'none',
          lines: ['Second'],
          sourceSlide: {
            songId,
            slideId: fixtureSlideId(2),
          },
        },
      ],
      jumpKeys: {Digit1: 'Verse'},
    });
    expect(source.backgroundOf).not.toHaveBeenCalled();
    const next = {
      ...source,
      labels: [{name: 'Verse', color: '#D07A8A', key: null}] as const,
    };
    expect(await showLibrarySong(next, songId)).toMatchObject({
      tiles: [{labelColor: '#D07A8A'}, {}],
      jumpKeys: {},
    });
  });

  it('keeps known fields read-only from a newer file', async () => {
    expect(
      await showLibrarySong(sources({access: 'readOnly'}), songId),
    ).toMatchObject({readOnly: true, problem: 'newer-version'});
  });

  it('projects a grouped song and maps hot keys', async () => {
    const gSongId = createSongId('20000000-0000-4000-8000-000000000010');

    const song: Song = {
      format: 'llsong',
      schemaVersion: 1,
      id: gSongId,
      title: 'Grouped Library Song',
      slides: [
        {
          id: fixtureSlideId(3),
          lines: ['G1 Line 1'],
          hotKey: 'KeyA',
          label: 'Verse',
        },
      ],
    };
    const source: LibrarySongSources = {
      song: vi.fn(() => ({
        song: song,
        revision: 4,
        access: 'editable' as const,
      })),
      labels: [{name: 'Verse', color: '#5FB8C2', key: 'Digit1'}],
      backgroundOf: vi.fn(() => Promise.resolve(null)),
    };
    expect(await showLibrarySong(source, gSongId)).toEqual({
      songId: gSongId,
      songRevision: 4,
      title: 'Grouped Library Song',
      readOnly: false,
      tiles: [
        {
          label: 'Verse',
          labelColor: '#5FB8C2',
          lines: ['G1 Line 1'],
          sourceSlide: {
            songId: gSongId,
            slideId: fixtureSlideId(3),
          },
          hotKey: 'KeyA',
        },
      ],
      jumpKeys: {Digit1: 'Verse'},
    });
  });

  it('caps song slide projection and marks tile-limit problem', async () => {
    const gSongId = createSongId('20000000-0000-4000-8000-000000000011');
    const slides = Array.from({length: 10_001}, (_, index) => ({
      id: fixtureSlideId(index),
      lines: [`Line ${index}`],
    }));
    const hugeSongDefault: Song = {
      format: 'llsong',
      schemaVersion: 1,
      id: gSongId,
      title: 'Huge Song Default',
      slides,
    };
    const source: LibrarySongSources = {
      song: vi.fn(() => ({
        song: hugeSongDefault,
        revision: 1,
        access: 'editable' as const,
      })),
      labels: [],
      backgroundOf: vi.fn(() => Promise.resolve(null)),
    };
    const result = await showLibrarySong(source, gSongId);
    expect(result?.readOnly).toBe(true);
    expect(result).toMatchObject({
      readOnly: true,
      problem: 'tile-limit',
      tiles: [],
    });
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
    expect(ipc.handlers.has(libraryEndpoints.showSong.channel)).toBe(false);
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
