import {
  mkdir,
  readdir,
  readFile,
  rm,
  utimes,
  writeFile,
} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {makeTempDir} from '../../../test/temp-dir';
import {createMediaId, type MediaId} from '@shared/schema/ids';
import {recordingLogger} from '../displays/testing';
import {ThumbnailCache} from './thumbnailCache';

const mediaId = (index: number): MediaId =>
  createMediaId(`00000000-0000-4000-8000-${String(index).padStart(12, '0')}`);

const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);

async function setup(maxEntries = 3) {
  const folder = join(await makeTempDir(), 'thumbnails');
  const log = recordingLogger();
  const cache = new ThumbnailCache({folder, log, maxEntries});
  return {folder, log, cache};
}

describe('thumbnail cache', () => {
  it('keeps a thumbnail under its media id and finds it again', async () => {
    const {folder, cache} = await setup();
    const file = await cache.put(mediaId(1), JPEG);
    expect(file).toBe(join(folder, `${mediaId(1)}.jpg`));
    expect(new Uint8Array(await readFile(file ?? ''))).toEqual(JPEG);
    expect(await cache.fileOf(mediaId(1))).toBe(file);
    expect(await cache.fileOf(mediaId(2))).toBeNull();
  });

  it('removes the least recently used thumbnail past the cap', async () => {
    const {folder, cache} = await setup();
    for (const index of [1, 2, 3]) await cache.put(mediaId(index), JPEG);
    await cache.fileOf(mediaId(1));
    await cache.put(mediaId(4), JPEG);
    expect(await cache.fileOf(mediaId(2))).toBeNull();
    expect((await readdir(folder)).sort()).toEqual(
      [1, 3, 4].map(index => `${mediaId(index)}.jpg`).sort(),
    );
  });

  it('finds what an earlier launch kept, oldest first, and ignores other files', async () => {
    const {folder, cache} = await setup(2);
    await mkdir(folder, {recursive: true});
    for (const [index, seconds] of [
      [1, 300],
      [2, 100],
      [3, 200],
    ] as const) {
      const file = join(folder, `${mediaId(index)}.jpg`);
      await writeFile(file, JPEG);
      await utimes(file, seconds, seconds);
    }
    await writeFile(join(folder, 'notes.txt'), 'invented');
    expect(await cache.fileOf(mediaId(2))).toBeNull();
    expect(await cache.fileOf(mediaId(1))).not.toBeNull();
    expect((await readdir(folder)).sort()).toEqual(
      [`${mediaId(1)}.jpg`, `${mediaId(3)}.jpg`, 'notes.txt'].sort(),
    );
  });

  it('removes a thumbnail, and starts empty without a folder', async () => {
    const {folder, cache, log} = await setup();
    expect(await cache.fileOf(mediaId(1))).toBeNull();
    await cache.put(mediaId(1), JPEG);
    await cache.remove(mediaId(1));
    await cache.remove(mediaId(2));
    expect(await cache.fileOf(mediaId(1))).toBeNull();
    expect(await readdir(folder)).toEqual([]);
    expect(log.messages('warn')).toEqual([]);
  });

  it('logs a thumbnail it cannot write and answers null', async () => {
    const root = await makeTempDir();
    const blocked = join(root, 'blocked');
    await writeFile(blocked, 'a file where the folder should be');
    const log = recordingLogger();
    const cache = new ThumbnailCache({
      folder: join(blocked, 'thumbnails'),
      log,
    });
    expect(await cache.put(mediaId(1), JPEG)).toBeNull();
    expect(log.messages('warn')).toContain('could not keep a thumbnail');
  });

  it('forgets a thumbnail whose file was deleted, so it is made again', async () => {
    const {folder, cache} = await setup();
    const file = await cache.put(mediaId(1), JPEG);
    await rm(folder, {recursive: true, force: true});
    expect(await cache.fileOf(mediaId(1))).toBeNull();
    expect(await cache.put(mediaId(1), JPEG)).toBe(file);
    expect(await cache.fileOf(mediaId(1))).toBe(file);
  });
});
