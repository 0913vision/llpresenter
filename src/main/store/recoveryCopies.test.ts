import {readdir, readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {makeTempDir} from '../../../test/temp-dir';
import {RecoveryCopies} from './recoveryCopies';

const MINUTE_MS = 60 * 1000;
const START = Date.UTC(2026, 9, 25, 10, 0, 0);

async function setUp(keep = 10) {
  const folder = await makeTempDir();
  const file = join(folder, 'song.llsong');
  const recovery = join(folder, '.복구 사본');
  let now = START;
  const copies = new RecoveryCopies({
    folder: recovery,
    keep: () => keep,
    now: () => now,
  });
  const target = {file, kind: 'song', id: 'song-1'};
  const copyFolder = join(recovery, 'song', 'song-1');
  return {
    file,
    copies,
    target,
    copyFolder,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe('RecoveryCopies', () => {
  it('keeps the previous version under its kind and id, named by time', async () => {
    const {file, copies, target, copyFolder} = await setUp();
    await writeFile(file, 'version 1');

    expect(await copies.keepPrevious(target)).toEqual({
      ok: true,
      value: undefined,
    });

    expect(await readdir(copyFolder)).toEqual([
      '2026-10-25T10-00-00.000Z.json',
    ]);
    expect(
      await readFile(join(copyFolder, '2026-10-25T10-00-00.000Z.json'), 'utf8'),
    ).toBe('version 1');
  });

  it('needs no copy of a file that does not exist yet', async () => {
    const {copies, target, copyFolder} = await setUp();

    expect((await copies.keepPrevious(target)).ok).toBe(true);
    expect(await readdir(copyFolder)).toEqual([]);
  });

  it('makes at most one copy of a file every 5 minutes', async () => {
    const {file, copies, target, copyFolder, advance} = await setUp();
    await writeFile(file, 'version 1');

    await copies.keepPrevious(target);
    advance(4 * MINUTE_MS);
    await copies.keepPrevious(target);
    expect(await readdir(copyFolder)).toHaveLength(1);

    advance(MINUTE_MS);
    await copies.keepPrevious(target);
    expect(await readdir(copyFolder)).toHaveLength(2);
  });

  it('deletes the oldest copies past the count to keep', async () => {
    const {file, copies, target, copyFolder, advance} = await setUp(2);
    for (const version of ['1', '2', '3']) {
      await writeFile(file, `version ${version}`);
      await copies.keepPrevious(target);
      advance(5 * MINUTE_MS);
    }

    const left = await readdir(copyFolder);

    expect(left).toEqual([
      '2026-10-25T10-05-00.000Z.json',
      '2026-10-25T10-10-00.000Z.json',
    ]);
  });

  it('keeps at most 50 copies whatever the count says', async () => {
    const {file, copies, target, copyFolder, advance} = await setUp(1000);
    for (let version = 0; version < 52; version++) {
      await writeFile(file, `version ${version}`);
      await copies.keepPrevious(target);
      advance(5 * MINUTE_MS);
    }

    expect(await readdir(copyFolder)).toHaveLength(50);
  });

  it('reports a copy it cannot make', async () => {
    const folder = await makeTempDir();
    const blocker = join(folder, 'blocker');
    await writeFile(blocker, 'a file where the recovery folder should be');
    const file = join(folder, 'song.llsong');
    await writeFile(file, 'version 1');
    const copies = new RecoveryCopies({folder: blocker, keep: () => 10});

    const result = await copies.keepPrevious({file, kind: 'song', id: 'x'});

    expect(result.ok ? undefined : result.error.file).toBe(file);
  });
});
