import {join, resolve} from 'node:path';
import {mkdir, rm, symlink, writeFile} from 'node:fs/promises';
import * as v from 'valibot';
import {describe, expect, it} from 'vitest';
import {mediaIdSchema, type MediaId} from '@core/schema/ids';
import type {MediaItem} from '@core/schema/mediaList';
import {buildMediaLibrary, LoadingMediaLibrary, NO_MEDIA} from './mediaLibrary';
import {itemId} from './testFiles';
import {makeTempDir} from '../../../test/temp-dir';

const MEDIA = resolve('/data/LoveLight/미디어');
const ELSEWHERE = resolve('/Volumes/영상/배경');
const LIST_FILE = resolve('/data/LoveLight/Settings/media.json');

const WARM = v.parse(mediaIdSchema, itemId(1));
const LIGHT = v.parse(mediaIdSchema, itemId(2));
const ESCAPE = v.parse(mediaIdSchema, itemId(3));

function item(id: MediaId, file: string): MediaItem {
  return {id, name: 'media', kind: 'video', file, size: 1};
}

function build(items: readonly MediaItem[]) {
  return buildMediaLibrary({
    items,
    mediaFolder: MEDIA,
    listFile: LIST_FILE,
  });
}

describe('buildMediaLibrary', () => {
  it('rechecks visual files, uses looping by default, and respects stop', async () => {
    const folder = await makeTempDir();
    const video = join(folder, 'video.webm');
    await writeFile(video, 'video');
    const {library} = buildMediaLibrary({
      items: [
        item(WARM, 'video.webm'),
        {...item(LIGHT, 'video.webm'), props: {end: 'stop'}},
        {...item(ESCAPE, 'video.webm'), kind: 'audio'},
      ],
      mediaFolder: folder,
      listFile: join(folder, 'media.json'),
    });

    await expect(library.backgroundOf(WARM)).resolves.toEqual({
      mediaId: WARM,
      loop: true,
    });
    await expect(library.backgroundOf(LIGHT)).resolves.toEqual({
      mediaId: LIGHT,
      loop: false,
    });
    await expect(library.backgroundOf(ESCAPE)).resolves.toBeNull();
    await expect(library.backgroundOf('unknown')).resolves.toBeNull();
    await rm(video);
    await expect(library.backgroundOf(WARM)).resolves.toBeNull();
    await writeFile(video, 'returned');
    await expect(library.backgroundOf(WARM)).resolves.toMatchObject({
      loop: true,
    });
  });

  it('refuses directories and links outside every catalogued media root', async () => {
    const folder = await makeTempDir();
    const outside = await makeTempDir();
    const originals = await makeTempDir();
    await mkdir(join(folder, 'directory'));
    await writeFile(join(outside, 'video.webm'), 'video');
    await writeFile(join(originals, 'original.webm'), 'original');
    await symlink(outside, join(folder, 'escape'), 'junction');
    const {library} = buildMediaLibrary({
      items: [
        item(WARM, 'directory'),
        item(LIGHT, join('escape', 'video.webm')),
        item(ESCAPE, join(originals, 'original.webm')),
      ],
      mediaFolder: folder,
      listFile: join(folder, 'media.json'),
    });
    for (const id of [WARM, LIGHT]) {
      await expect(library.backgroundOf(id)).resolves.toBeNull();
    }
    await expect(library.backgroundOf(ESCAPE)).resolves.toMatchObject({
      mediaId: ESCAPE,
    });
  });

  it('finds a relative file in the media folder and keeps an absolute one', () => {
    const outside = join(ELSEWHERE, '따뜻한 빛.mp4');
    const {library, problems} = build([
      item(WARM, outside),
      item(LIGHT, join('배경', '빛.mp4')),
    ]);

    expect(library.fileOf(LIGHT)).toBe(join(MEDIA, '배경', '빛.mp4'));
    expect(library.fileOf(WARM)).toBe(outside);
    expect(library.fileOf('missing')).toBeNull();
    expect(library.roots).toEqual([MEDIA, ELSEWHERE]);
    expect(problems).toEqual([]);
  });

  it('refuses a relative path that leaves the media folder', () => {
    const {library, problems} = build([
      item(ESCAPE, join('..', 'Settings', 'app.json')),
    ]);

    expect(library.fileOf(ESCAPE)).toBeNull();
    expect(problems).toEqual([
      expect.objectContaining({file: LIST_FILE, field: 'items.0.file'}),
    ]);
  });

  it('keeps catalogued absolute originals outside the app data folder', () => {
    const inside = join(MEDIA, '빛.mp4');
    const {library, problems} = build([
      item(WARM, inside),
      item(LIGHT, join(ELSEWHERE, 'a.mp4')),
    ]);

    expect(library.fileOf(WARM)).toBe(inside);
    expect(library.fileOf(LIGHT)).toBe(join(ELSEWHERE, 'a.mp4'));
    expect(library.roots).toEqual([MEDIA, ELSEWHERE]);
    expect(problems).toEqual([]);
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
    const {library} = build([item(LIGHT, '빛.mp4')]);

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
