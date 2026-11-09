import {stat, utimes, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {makeTempDir} from '@fixtures/tempDir';
import {createMediaId, type MediaId} from '@core/schema/ids';
import {parseMediaDocument, type MediaDocument} from '@core/schema/mediaEdit';
import {expectSuccess} from '@fixtures/core/schema/testHelpers';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {EMPTY_MEDIA_LIST} from '@main/store/defaults';
import type {Analysis, AnalysisRequest} from '@main/media/mediaAnalyser';
import type {BundledPicture} from '@main/store/bundledPicture';
import {Thumbnails, type ThumbnailSource} from '@main/media/thumbnails';

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
  pictures: readonly BundledPicture[] = [],
) {
  const state = {entries, document: documentOf(entries)};
  const listeners = new Set<(document: MediaDocument) => void>();
  const source: ThumbnailSource = {
    pictures,
    get: () => state.document,
    fileOf: id => {
      const picture = pictures.find(picture => picture.id === id);
      if (picture !== undefined) return picture.file;
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
  const stamps = new Map<MediaId, string>();
  const cache = {
    stampOf: vi.fn((id: MediaId) => Promise.resolve(stamps.get(id) ?? null)),
    fileOf: vi.fn((id: MediaId) =>
      Promise.resolve(kept.has(id) ? `cache/${id}.jpg` : null),
    ),
    put: vi.fn((id: MediaId, jpeg: Uint8Array, stamp?: string) => {
      kept.set(id, jpeg);
      if (stamp !== undefined) stamps.set(id, stamp);
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
  return {thumbnails, cache, kept, stamps, analyse, change, listeners};
}

describe('media thumbnails', () => {
  it('analyses app pictures absent from user media and keeps their thumbnails across catalog edits', async () => {
    const file = 'D:/app/assets/scripture.png';
    const {thumbnails, analyse, change, cache} = setup(new Map(), [
      {id: VIDEO, name: 'Scripture', file},
    ]);
    await thumbnails.start();
    expect(await thumbnails.thumbnailOf(VIDEO)).toBe(`cache/${VIDEO}.jpg`);
    expect(analyse).toHaveBeenCalledExactlyOnceWith({
      file,
      kind: 'image',
      thumbnail: true,
    });
    change(new Map());
    expect(cache.remove).not.toHaveBeenCalled();
    expect(await thumbnails.thumbnailOf(VIDEO)).toBe(`cache/${VIDEO}.jpg`);
    expect(analyse).toHaveBeenCalledOnce();
  });
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
    await thumbnails.save(VIDEO, JPEG, 'D:/media/dawn.mp4');
    expect(kept.get(VIDEO)).toEqual(JPEG);
    thumbnails.dispose();
    expect(listeners.size).toBe(0);
    expect(await thumbnails.thumbnailOf(VIDEO)).toBeNull();
  });

  it('accepts a cached thumbnail only for a current item with a picture and an accepted path', async () => {
    const OTHER = mediaId(5);
    const {thumbnails, kept, analyse} = setup(
      new Map([
        [VIDEO, {kind: 'video', file: 'D:/media/dawn.mp4'}],
        [SONG, {kind: 'audio', file: 'D:/media/hymn.mp3'}],
        [mediaId(4), {kind: 'image', file: null}],
      ]),
    );
    for (const id of [VIDEO, SONG, mediaId(4), OTHER]) kept.set(id, JPEG);
    expect(await thumbnails.thumbnailOf(SONG)).toBeNull();
    expect(await thumbnails.thumbnailOf(mediaId(4))).toBeNull();
    expect(await thumbnails.thumbnailOf(OTHER)).toBeNull();
    expect(await thumbnails.thumbnailOf(VIDEO)).toBe(`cache/${VIDEO}.jpg`);
    expect(analyse).not.toHaveBeenCalled();
  });

  it('saves an import thumbnail only for the file it was made from, also while it is written', async () => {
    const {thumbnails, kept, cache, change} = setup();
    await thumbnails.save(VIDEO, JPEG, 'D:/media/older.mp4');
    expect(kept.size).toBe(0);
    cache.put.mockImplementationOnce((id: MediaId, jpeg: Uint8Array) => {
      kept.set(id, jpeg);
      change(new Map([[VIDEO, {kind: 'video', file: 'D:/found/dawn.mp4'}]]));
      return Promise.resolve(`cache/${id}.jpg`);
    });
    await thumbnails.save(VIDEO, JPEG, 'D:/media/dawn.mp4');
    expect(kept.size).toBe(0);
    expect(cache.remove).toHaveBeenCalledWith(VIDEO);
  });
});

describe('a thumbnail and a file replaced in place', () => {
  async function made(stampOfFile: (size: number, modified: number) => string) {
    const folder = await makeTempDir();
    const source = join(folder, 'dawn.mp4');
    await writeFile(source, 'invented');
    const dated = Date.now() / 1000 - 100;
    await utimes(source, dated, dated);
    const {size, mtimeMs} = await stat(source);
    const fixture = setup(new Map([[VIDEO, {kind: 'video', file: source}]]));
    fixture.kept.set(VIDEO, JPEG);
    fixture.stamps.set(VIDEO, stampOfFile(size, Math.floor(mtimeMs)));
    fixture.cache.fileOf.mockImplementation(() =>
      Promise.resolve(join(folder, 'thumb.jpg')),
    );
    return {...fixture, source, size, mtimeMs};
  }

  it('keeps the thumbnail made from this very file', async () => {
    const {thumbnails, cache, analyse} = await made(
      (size, modified) => `${size}:${modified}`,
    );
    expect(await thumbnails.thumbnailOf(VIDEO)).toContain('thumb.jpg');
    expect(cache.remove).not.toHaveBeenCalled();
    expect(analyse).not.toHaveBeenCalled();
  });

  it.each([
    [
      'an older time',
      (size: number, modified: number) => `${size}:${modified - 5000}`,
    ],
    [
      'a newer time, as after a replacement by an older-dated file',
      (size: number, modified: number) => `${size}:${modified + 5000}`,
    ],
    [
      'another size at the same time',
      (size: number, modified: number) => `${size + 1}:${modified}`,
    ],
    ['no stamp', () => ''],
  ])(
    'makes the thumbnail again when it was made from a file with %s',
    async (_name, stampOf) => {
      const {thumbnails, cache, analyse} = await made(stampOf);
      await thumbnails.thumbnailOf(VIDEO);
      expect(cache.remove).toHaveBeenCalledWith(VIDEO);
      expect(analyse).toHaveBeenCalledOnce();
    },
  );

  it('keeps a new thumbnail with the size and time of the file it was made from', async () => {
    const folder = await makeTempDir();
    const source = join(folder, 'dawn.mp4');
    await writeFile(source, 'invented');
    const dated = Date.now() / 1000 - 5000;
    await utimes(source, dated, dated);
    const {thumbnails, cache} = setup(
      new Map([[VIDEO, {kind: 'video', file: source}]]),
    );
    await thumbnails.thumbnailOf(VIDEO);
    const {size, mtimeMs} = await stat(source);
    expect(cache.put).toHaveBeenCalledWith(
      VIDEO,
      JPEG,
      `${size}:${Math.floor(mtimeMs)}`,
    );
  });
});
