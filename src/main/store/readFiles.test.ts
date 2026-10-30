import {join} from 'node:path';
import {readFile, writeFile} from 'node:fs/promises';
import {describe, expect, it} from 'vitest';
import {parseSong} from '@core/schema/song';
import {makeTempDir} from '../../../test/temp-dir';
import {listFolder, loadFile, readTextFile} from './readFiles';
import {HYMN_ONE_ID, hymnOne, writeJson} from './testFiles';

describe('readTextFile', () => {
  it('reads the text, or null when the file does not exist', async () => {
    const folder = await makeTempDir();
    await writeJson(join(folder, 'a.txt'), '만복의 근원');

    expect(await readTextFile(join(folder, 'a.txt'))).toEqual({
      ok: true,
      value: '만복의 근원',
    });
    expect(await readTextFile(join(folder, 'missing.txt'))).toEqual({
      ok: true,
      value: null,
    });
  });

  it('reports a path it cannot read as a file', async () => {
    const folder = await makeTempDir();

    expect(await readTextFile(folder)).toMatchObject({
      ok: false,
      error: {kind: 'read', file: folder},
    });
  });

  it('keeps valid replacement characters and a byte order mark intact', async () => {
    const folder = await makeTempDir();
    const file = join(folder, 'valid.json');
    await writeFile(file, '\uFEFF{"text":"\uFFFD"}', 'utf8');
    expect(await readTextFile(file)).toEqual({
      ok: true,
      value: '\uFEFF{"text":"\uFFFD"}',
    });
  });
});

describe('loadFile', () => {
  it('reads a file through its schema', async () => {
    const folder = await makeTempDir();
    const file = join(folder, 'a.llsong');
    await writeJson(file, hymnOne());

    const loaded = await loadFile(file, parseSong);

    expect(loaded.ok && loaded.value?.data.id).toBe(HYMN_ONE_ID);
  });

  it('gives null for a missing file and the schema problem for a broken one', async () => {
    const folder = await makeTempDir();
    const broken = join(folder, 'broken.llsong');
    await writeJson(broken, {...hymnOne(), title: ''});

    expect(await loadFile(join(folder, 'missing.llsong'), parseSong)).toEqual({
      ok: true,
      value: null,
    });
    expect(await loadFile(broken, parseSong)).toMatchObject({
      ok: false,
      error: {kind: 'invalid', field: 'title'},
    });
  });

  it.each([
    {invalid: [0xff]},
    {invalid: [0xe2, 0x82]},
    {invalid: [0xc0, 0x80]},
  ])(
    'rejects invalid UTF-8 bytes %j in otherwise valid JSON without modifying the file',
    async ({invalid}) => {
      const folder = await makeTempDir();
      const file = join(folder, 'damaged.llsong');
      const json = JSON.stringify({...hymnOne(), title: 'INVENTED_MARKER'});
      const [before, after] = json.split('INVENTED_MARKER');
      if (before === undefined || after === undefined) {
        throw new Error('Missing fixture marker');
      }
      const bytes = Buffer.concat([
        Buffer.from(before),
        Buffer.from(invalid),
        Buffer.from(after),
      ]);
      await writeFile(file, bytes);
      expect(await loadFile(file, parseSong)).toMatchObject({
        ok: false,
        error: {kind: 'read', file},
      });
      expect(await readFile(file)).toEqual(bytes);
    },
  );
});

describe('listFolder', () => {
  it('lists the names in sorted order, and none for a missing folder', async () => {
    const folder = await makeTempDir();
    await writeJson(join(folder, 'b.json'), {});
    await writeJson(join(folder, 'a.json'), {});

    expect(await listFolder(folder)).toEqual({
      ok: true,
      value: ['a.json', 'b.json'],
    });
    expect(await listFolder(join(folder, 'missing'))).toEqual({
      ok: true,
      value: [],
    });
  });
});
