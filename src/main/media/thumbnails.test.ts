import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {createMediaId, type MediaId} from '@shared/schema/ids';
import {parseMediaDocument, type MediaDocument} from '@shared/schema/mediaEdit';
import {expectSuccess} from '@shared/schema/testHelpers';
import {recordingLogger} from '../displays/testing';
import {EMPTY_MEDIA_LIST} from '../store/defaults';
import type {Analysis, AnalysisRequest} from './mediaAnalyser';
import {Thumbnails, type ThumbnailSource} from './thumbnails';

const mediaId = (index: number): MediaId =>
  createMediaId(`00000000-0000-4000-8000-${String(index).padStart(12, '0')}`);

const VIDEO = mediaId(1);
const SONG = mediaId(2);
const JPEG = Uint8Array.from([0xff, 0xd8]);

interface Entry {
  readonly kind: 'video' | 'image' | 'audio';
  readonly file: string | null;
}

function documentOf(entries: ReadonlyMap<MediaId, Entry>): MediaDocument {
  return expectSuccess(
    parseMediaDocument({
      name: 'media',
      revision: 1,
      access: 'editable',
      value: {
        ...EMPTY_MEDIA_LIST,
        items: [...entries].map(([id, {kind}]) => ({
          id,
          name: 'Invented',
          kind,
          file: `${id}.media`,
          size: 1,
        })),
      },
    }),
  );
}

function setup(
  entries: ReadonlyMap<MediaId, Entry> = new Map([
    [VIDEO, {kind: 'video', file: 'D:/media/dawn.mp4'}],
    [SONG, {kind: 'audio', file: 'D:/media/hymn.mp3'}],
  ]),
) {
  const state = {entries, document: documentOf(entries)};
  const listeners = new Set<(document: MediaDocument) => void>();
  const source: ThumbnailSource = {
    get: () => state.document,
    fileOf: id => {
      for (const [key, entry] of state.entries) {
        if (key === id) return entry.file;
      }
      return null;
    },
    subscribe: listener => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  const change = (next: ReadonlyMap<MediaId, Entry>): void => {
    state.entries = next;
    state.document = documentOf(next);
    for (const listener of listeners) listener(state.document);
  };
  const kept = new Map<MediaId, Uint8Array>();
  const cache = {
    fileOf: vi.fn((id: MediaId) =>
      Promise.resolve(kept.has(id) ? `cache/${id}.jpg` : null),
    ),
    put: vi.fn((id: MediaId, jpeg: Uint8Array) => {
      kept.set(id, jpeg);
      return Promise.resolve<string | null>(`cache/${id}.jpg`);
    }),
    remove: vi.fn((id: MediaId) => {
      kept.delete(id);
      return Promise.resolve();
    }),
  };
  const analyse = vi.fn<(request: AnalysisRequest) => Promise<Analysis>>(() =>
    Promise.resolve({kind: 'read', facts: {thumbnail: JPEG}}),
  );
  const thumbnails = new Thumbnails({
    cache,
    analyse,
    source: Promise.resolve(source),
    log: recordingLogger(),
  });
  onTestFinished(() => {
    thumbnails.dispose();
  });
  return {thumbnails, cache, kept, analyse, change, listeners};
}

describe('media thumbnails', () => {
  it('makes a missing thumbnail through analysis, keeps it, and reuses it', async () => {
    const {thumbnails, kept, analyse} = setup();
    expect(await thumbnails.thumbnailOf(VIDEO)).toBe(`cache/${VIDEO}.jpg`);
    expect(analyse).toHaveBeenCalledExactlyOnceWith({
      file: 'D:/media/dawn.mp4',
      kind: 'video',
      thumbnail: true,
    });
    expect(kept.get(VIDEO)).toEqual(JPEG);
    expect(await thumbnails.thumbnailOf(VIDEO)).toBe(`cache/${VIDEO}.jpg`);
    expect(analyse).toHaveBeenCalledOnce();
  });

  it('makes one thumbnail for requests that arrive together', async () => {
    const {thumbnails, analyse} = setup();
    const both = await Promise.all([
      thumbnails.thumbnailOf(VIDEO),
      thumbnails.thumbnailOf(VIDEO),
    ]);
    expect(both).toEqual([`cache/${VIDEO}.jpg`, `cache/${VIDEO}.jpg`]);
    expect(analyse).toHaveBeenCalledOnce();
  });

  it('has none for audio, an unknown or malformed id, or a refused path', async () => {
    const {thumbnails, analyse} = setup(
      new Map([
        [VIDEO, {kind: 'video', file: null}],
        [SONG, {kind: 'audio', file: 'D:/media/hymn.mp3'}],
      ]),
    );
    for (const value of [SONG, VIDEO, mediaId(9), 'not-an-id']) {
      expect(await thumbnails.thumbnailOf(value)).toBeNull();
    }
    expect(analyse).not.toHaveBeenCalled();
  });

  it('tries a refused file again only after its path changes', async () => {
    const {thumbnails, analyse, change} = setup();
    await thumbnails.start();
    analyse.mockResolvedValue({
      kind: 'cant-play',
      reason: 'decode',
      message: 'Invented',
    });
    expect(await thumbnails.thumbnailOf(VIDEO)).toBeNull();
    expect(await thumbnails.thumbnailOf(VIDEO)).toBeNull();
    expect(analyse).toHaveBeenCalledOnce();
    change(new Map([[VIDEO, {kind: 'video', file: 'D:/found/dawn.mp4'}]]));
    await thumbnails.thumbnailOf(VIDEO);
    expect(analyse).toHaveBeenCalledTimes(2);
  });

  it('tries again after analysis was unavailable', async () => {
    const {thumbnails, analyse} = setup();
    analyse.mockResolvedValueOnce({kind: 'unavailable', message: 'Invented'});
    expect(await thumbnails.thumbnailOf(VIDEO)).toBeNull();
    expect(await thumbnails.thumbnailOf(VIDEO)).toBe(`cache/${VIDEO}.jpg`);
  });

  it('drops the thumbnail of a changed file or a removed item', async () => {
    const {thumbnails, cache, kept, change} = setup();
    await thumbnails.start();
    await thumbnails.thumbnailOf(VIDEO);
    change(
      new Map([
        [VIDEO, {kind: 'video', file: 'D:/found/dawn.mp4'}],
        [SONG, {kind: 'audio', file: 'D:/media/hymn.mp3'}],
      ]),
    );
    expect(kept.has(VIDEO)).toBe(false);
    await thumbnails.thumbnailOf(VIDEO);
    change(new Map([[SONG, {kind: 'audio', file: 'D:/media/hymn.mp3'}]]));
    expect(cache.remove).toHaveBeenCalledTimes(2);
    expect(kept.size).toBe(0);
  });

  it('keeps no thumbnail made for a file that changed meanwhile', async () => {
    const {thumbnails, kept, analyse, change} = setup();
    await thumbnails.start();
    analyse.mockImplementationOnce(() => {
      change(new Map([[VIDEO, {kind: 'video', file: 'D:/found/dawn.mp4'}]]));
      return Promise.resolve({kind: 'read', facts: {thumbnail: JPEG}});
    });
    expect(await thumbnails.thumbnailOf(VIDEO)).toBeNull();
    expect(kept.size).toBe(0);
  });

  it('saves an import thumbnail, and stops following the list on dispose', async () => {
    const {thumbnails, kept, listeners} = setup();
    await thumbnails.start();
    await thumbnails.save(VIDEO, JPEG);
    expect(kept.get(VIDEO)).toEqual(JPEG);
    thumbnails.dispose();
    expect(listeners.size).toBe(0);
    expect(await thumbnails.thumbnailOf(VIDEO)).toBeNull();
  });
});
