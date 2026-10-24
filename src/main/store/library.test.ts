import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {parseSong} from '@shared/schema/song';
import {makeTempDir} from '../../../test/temp-dir';
import {loadFolder} from './library';
import {HYMN_ONE_ID, hymnOne, writeJson} from './testFiles';

const OTHER_SONG_ID = '7a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

describe('loadFolder', () => {
  it('loads every file with the extension, by id', async () => {
    const folder = await makeTempDir();
    await writeJson(join(folder, 'a.llsong'), hymnOne());
    await writeJson(join(folder, 'b.llsong'), {
      ...hymnOne(),
      id: OTHER_SONG_ID,
      title: '다른 곡',
    });
    await writeJson(join(folder, 'notes.txt'), 'not a song');

    const loaded = await loadFolder(folder, '.llsong', parseSong);

    expect([...loaded.items.keys()].sort()).toEqual(
      [HYMN_ONE_ID, OTHER_SONG_ID].sort(),
    );
    expect(loaded.problems).toEqual([]);
  });

  it('skips and reports a broken file, and loads the rest', async () => {
    const folder = await makeTempDir();
    await writeJson(join(folder, 'good.llsong'), hymnOne());
    await writeJson(join(folder, 'broken.llsong'), '{"format": ');

    const loaded = await loadFolder(folder, '.llsong', parseSong);

    expect([...loaded.items.keys()]).toEqual([HYMN_ONE_ID]);
    expect(loaded.problems).toEqual([
      expect.objectContaining({
        kind: 'json',
        file: join(folder, 'broken.llsong'),
      }),
    ]);
  });

  it('reports a second file with the same id', async () => {
    const folder = await makeTempDir();
    await writeJson(join(folder, 'a.llsong'), hymnOne());
    await writeJson(join(folder, 'b.llsong'), {...hymnOne(), title: '복사본'});

    const loaded = await loadFolder(folder, '.llsong', parseSong);

    expect(loaded.items.get(HYMN_ONE_ID)?.data.title).toBe(
      '만복의 근원 하나님',
    );
    expect(loaded.problems).toEqual([
      expect.objectContaining({
        kind: 'invalid',
        file: join(folder, 'b.llsong'),
        field: 'id',
      }),
    ]);
  });

  it('finds nothing in a folder that does not exist yet', async () => {
    const folder = await makeTempDir();

    const loaded = await loadFolder(join(folder, '곡'), '.llsong', parseSong);

    expect(loaded.items.size).toBe(0);
    expect(loaded.problems).toEqual([]);
  });

  it('reports a folder it cannot read', async () => {
    const folder = await makeTempDir();
    const notAFolder = join(folder, '곡');
    await writeJson(notAFolder, 'a file where the folder should be');

    const loaded = await loadFolder(notAFolder, '.llsong', parseSong);

    expect(loaded.problems).toEqual([
      expect.objectContaining({kind: 'read', file: notAFolder}),
    ]);
  });
});
