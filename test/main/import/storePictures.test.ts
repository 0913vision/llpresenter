import {existsSync} from 'node:fs';
import {readdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import type {MediaItem} from '@core/schema/media/mediaList';
import type {MediaItemsCommit} from '@main/store/media/mediaStore';
import {
  storeBackgrounds,
  storeSlidePictures,
  type PictureStore,
} from '@main/import/storePictures';
import {makeTempDir} from '@fixtures/tempDir';

function png(width: number, height: number, last = 0): Buffer {
  const bytes = Buffer.alloc(32);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes);
  bytes.write('IHDR', 12);
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  bytes[31] = last;
  return bytes;
}

async function setup(refusal?: 'stale' | 'write-failed') {
  const folder = await makeTempDir();
  const work = await makeTempDir();
  const commits: MediaItemsCommit[] = [];
  let items: readonly MediaItem[] = [];
  let refusals = refusal === undefined ? 0 : 1;
  const media: PictureStore = {
    folder,
    get: () => ({
      name: 'media',
      access: 'editable',
      revision: commits.length + 1,
      value: {
        format: 'llmedia',
        schemaVersion: 1,
        items: [...items],
        playlists: [],
        audioPlaylists: [],
      },
    }),
    fileOf: id => {
      const item = items.find(entry => entry.id === id);
      return item === undefined ? null : join(folder, item.file);
    },
    add: commit => {
      if (refusals > 0 && refusal !== undefined) {
        refusals -= 1;
        return Promise.resolve({
          ok: false,
          error:
            refusal === 'stale'
              ? {reason: refusal, message: 'Invented refusal'}
              : {
                  reason: refusal,
                  message: 'Invented refusal',
                  applied: {id: commit.items[0]?.id ?? '', revision: null},
                  unchangedFiles: [],
                },
        });
      }
      commits.push(commit);
      items = [...items, ...commit.items];
      return Promise.resolve({ok: true, value: null});
    },
  };
  return {
    media,
    commits,
    names: () => items.map(item => item.name),
    files: () => readdir(folder),
    write: async (name: string, bytes: Buffer) => {
      const path = join(work, name);
      await writeFile(path, bytes);
      return path;
    },
  };
}

describe('storeBackgrounds', () => {
  it('names new pictures after the song, in one change of the list', async () => {
    const {media, commits, write, files} = await setup();
    const paths = [
      await write('a.png', png(1920, 1080)),
      await write(
        'b.JPG',
        Buffer.from([255, 216, 255, 192, 0, 7, 8, 4, 56, 7, 128]),
      ),
    ];
    const ids = await storeBackgrounds(media, paths, '새 노래');
    expect(commits).toHaveLength(1);
    expect(commits[0]?.items).toEqual([
      {
        id: ids[0],
        name: '새 노래 배경',
        kind: 'image',
        file: `llp-ppt-${ids[0]}.png`,
        size: 32,
        width: 1920,
        height: 1080,
      },
      {
        id: ids[1],
        name: '새 노래 배경 2',
        kind: 'image',
        file: `llp-ppt-${ids[1]}.jpg`,
        size: 11,
        width: 1920,
        height: 1080,
      },
    ]);
    expect(await files()).toHaveLength(2);
  });

  it('uses a picture again that the list or the song has already', async () => {
    const {media, commits, write, names} = await setup();
    const first = await write('a.png', png(1920, 1080));
    const [known] = await storeBackgrounds(media, [first], '첫 노래');
    const ids = await storeBackgrounds(
      media,
      [
        await write('b.png', png(1920, 1080, 1)),
        await write('c.png', png(1920, 1080)),
        await write('d.png', png(1920, 1080, 1)),
      ],
      '둘째 노래',
    );
    expect(ids).toEqual([ids[0], known, ids[0]]);
    expect(names()).toEqual(['첫 노래 배경', '둘째 노래 배경']);
    await storeBackgrounds(media, [first], '셋째 노래');
    expect(commits).toHaveLength(2);
  });

  it('never uses a picture that only a slide has', async () => {
    const {media, write, names} = await setup();
    const path = await write('a.png', png(1920, 1080));
    const [slide] = await storeSlidePictures(media, [path]);
    const [background] = await storeBackgrounds(media, [path], '노래');
    expect(background).not.toBe(slide);
    expect(names()).toEqual(['', '노래 배경']);
  });

  it('tries again when the list changed meanwhile', async () => {
    const {media, write, commits} = await setup('stale');
    await storeBackgrounds(media, [await write('a.png', png(8, 8))], '노래');
    expect(commits).toHaveLength(1);
  });

  it('leaves no files behind when a picture cannot be stored', async () => {
    const {media, write, files, commits} = await setup();
    const path = await write('a.png', png(8, 8));
    await expect(
      storeBackgrounds(media, [path, join(path, 'missing.png')], '노래'),
    ).rejects.toThrow();
    await expect(
      storeBackgrounds(
        media,
        [await write('b.png', Buffer.from('no'))],
        '노래',
      ),
    ).rejects.toThrow('Not a picture that can be shown');
    expect(commits).toEqual([]);
    expect(await files()).toEqual([]);
  });

  it('leaves the files for a list that could not be written', async () => {
    const {media, write, files} = await setup('write-failed');
    await expect(
      storeBackgrounds(media, [await write('a.png', png(8, 8))], '노래'),
    ).rejects.toThrow('Media save failed');
    expect(await files()).toHaveLength(1);
  });
});

describe('storeSlidePictures', () => {
  it('keeps the pictures out of sight, each its own file', async () => {
    const {media, commits, write} = await setup();
    const path = await write('a.png', png(1920, 1080));
    const ids = await storeSlidePictures(media, [path, path]);
    expect(new Set(ids).size).toBe(2);
    expect(commits[0]?.items.map(item => [item.name, item.internal])).toEqual([
      ['', true],
      ['', true],
    ]);
    expect(existsSync(join(media.folder, `llp-ppt-${ids[1]}.png`))).toBe(true);
  });
});
