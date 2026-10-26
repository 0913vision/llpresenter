import {readdir, readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {makeTempDir} from '../../../test/temp-dir';
import {copyWithProgress, freePath} from './copyFile';
import {MEDIA_EXTENSIONS, mediaDialogFilters, mediaKindOf} from './mediaKinds';

describe('media kinds', () => {
  it.each([
    ['Morning light.MP4', 'video'],
    ['notice.webp', 'image'],
    ['prelude.mp3', 'audio'],
    ['notes.txt', null],
    ['no-extension', null],
  ])('reads %s as %s', (file, kind) => {
    expect(mediaKindOf(file)).toBe(kind);
  });

  it('offers every supported file first, then each kind', () => {
    const filters = mediaDialogFilters();
    expect(filters.map(({name}) => name)).toEqual([
      '미디어',
      '동영상',
      '이미지',
      '오디오',
    ]);
    expect(filters[0]?.extensions).toEqual([
      ...MEDIA_EXTENSIONS.video,
      ...MEDIA_EXTENSIONS.image,
      ...MEDIA_EXTENSIONS.audio,
    ]);
    expect(mediaDialogFilters(['image'])).toEqual([
      {name: '이미지', extensions: [...MEDIA_EXTENSIONS.image]},
    ]);
  });
});

describe('copying with progress', () => {
  it('copies through a temporary file and reports rising whole percents up to 100', async () => {
    const folder = await makeTempDir();
    const from = join(folder, 'source.mp4');
    await writeFile(from, Buffer.alloc(256 * 1024, 7));
    const percents: number[] = [];
    const copied = await copyWithProgress({
      from,
      to: join(folder, 'media', 'copy.mp4'),
      signal: new AbortController().signal,
      onPercent: percent => percents.push(percent),
    });
    expect(copied).toEqual({ok: true, value: 256 * 1024});
    expect(percents.at(-1)).toBe(100);
    expect(percents).toEqual([...new Set(percents)].sort((a, b) => a - b));
    expect(await readdir(join(folder, 'media'))).toEqual(['copy.mp4']);
    expect(await readFile(join(folder, 'media', 'copy.mp4'))).toEqual(
      await readFile(from),
    );
  });

  it('leaves nothing behind when cancelled or when the source is missing', async () => {
    const folder = await makeTempDir();
    const from = join(folder, 'source.mp4');
    await writeFile(from, 'invented');
    const abort = new AbortController();
    abort.abort();
    const cancelled = await copyWithProgress({
      from,
      to: join(folder, 'out', 'copy.mp4'),
      signal: abort.signal,
      onPercent: () => undefined,
    });
    const missing = await copyWithProgress({
      from: join(folder, 'missing.mp4'),
      to: join(folder, 'out', 'other.mp4'),
      signal: new AbortController().signal,
      onPercent: () => undefined,
    });
    expect(cancelled.ok).toBe(false);
    expect(missing.ok).toBe(false);
    expect(await readdir(join(folder, 'out')).catch(() => [])).toEqual([]);
  });

  it('numbers a name that is taken', async () => {
    const folder = await makeTempDir();
    expect(await freePath(folder, 'light.mp4')).toBe(join(folder, 'light.mp4'));
    await writeFile(join(folder, 'light.mp4'), '');
    await writeFile(join(folder, 'light (2).mp4'), '');
    expect(await freePath(folder, 'light.mp4')).toBe(
      join(folder, 'light (3).mp4'),
    );
  });
});
