import {join, resolve} from 'node:path';
import * as v from 'valibot';
import {describe, expect, it} from 'vitest';
import {mediaIdSchema, type MediaId} from '@shared/schema/ids';
import type {MediaItem} from '@shared/schema/mediaList';
import {buildMediaLibrary, LoadingMediaLibrary, NO_MEDIA} from './mediaLibrary';
import {itemId} from './testFiles';

const MEDIA = resolve('/data/LoveLight/미디어');
const ELSEWHERE = resolve('/Volumes/영상/배경');
const LIST_FILE = resolve('/data/LoveLight/설정/media.json');

const WARM = v.parse(mediaIdSchema, itemId(1));
const LIGHT = v.parse(mediaIdSchema, itemId(2));
const ESCAPE = v.parse(mediaIdSchema, itemId(3));

function item(id: MediaId, file: string): MediaItem {
  return {id, name: 'media', kind: 'video', file, size: 1};
}

function build(items: readonly MediaItem[], developmentFolder: string | null) {
  return buildMediaLibrary({
    items,
    mediaFolder: MEDIA,
    developmentFolder,
    listFile: LIST_FILE,
  });
}

describe('buildMediaLibrary', () => {
  it('finds a relative file in the media folder and keeps an absolute one', () => {
    const outside = join(ELSEWHERE, '따뜻한 빛.mp4');
    const {library, problems} = build(
      [item(WARM, outside), item(LIGHT, join('배경', '빛.mp4'))],
      null,
    );

    expect(library.fileOf(LIGHT)).toBe(join(MEDIA, '배경', '빛.mp4'));
    expect(library.fileOf(WARM)).toBe(outside);
    expect(library.fileOf('missing')).toBeNull();
    expect(library.roots).toEqual([MEDIA, ELSEWHERE]);
    expect(problems).toEqual([]);
  });

  it('refuses a relative path that leaves the media folder', () => {
    const {library, problems} = build(
      [item(ESCAPE, join('..', '설정', 'app.json'))],
      null,
    );

    expect(library.fileOf(ESCAPE)).toBeNull();
    expect(problems).toEqual([
      expect.objectContaining({file: LIST_FILE, field: 'items.0.file'}),
    ]);
  });

  it('serves only the media folder in development', () => {
    const inside = join(MEDIA, '빛.mp4');
    const {library, problems} = build(
      [item(WARM, inside), item(LIGHT, join(ELSEWHERE, 'a.mp4'))],
      resolve('/data'),
    );

    expect(library.fileOf(WARM)).toBe(inside);
    expect(library.fileOf(LIGHT)).toBeNull();
    expect(library.roots).toEqual([MEDIA]);
    expect(problems).toEqual([
      expect.objectContaining({field: 'items.1.file'}),
    ]);
  });
});

describe('LoadingMediaLibrary', () => {
  it('waits for the data, then finds files and gives the roots', async () => {
    type Loaded = {media: typeof NO_MEDIA} | null;
    let finish: (value: Loaded) => void = () => undefined;
    const loading = new Promise<Loaded>(resolve => {
      finish = resolve;
    });
    const media = new LoadingMediaLibrary(loading);
    const {library} = build([item(LIGHT, '빛.mp4')], null);

    const found = media.findFile(LIGHT);
    expect(media.roots()).toEqual([]);
    finish({media: library});

    await expect(found).resolves.toBe(join(MEDIA, '빛.mp4'));
    expect(media.roots()).toEqual([MEDIA]);
  });

  it('has no media when the data could not be read', async () => {
    const media = new LoadingMediaLibrary(Promise.resolve(null));

    await expect(media.findFile(LIGHT)).resolves.toBeNull();
    expect(media.roots()).toEqual([]);
  });
});
