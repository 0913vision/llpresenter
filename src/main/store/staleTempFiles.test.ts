import {mkdir, readdir, rm, symlink, utimes} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it, onTestFinished} from 'vitest';
import {makeTempDir} from '../../../test/temp-dir';
import {isTemporaryFileName} from './atomicWrite';
import {removeStaleTempFiles} from './staleTempFiles';
import {writeJson} from './testFiles';

const UUID = '3b9d0c52-7e1f-4a2b-8c3d-4e5f60718293';
const NIL_UUID = '00000000-0000-0000-0000-000000000000';
const VERSION_1_UUID = '3b9d0c52-7e1f-1a2b-8c3d-4e5f60718293';
const OTHER_VARIANT_UUID = '3b9d0c52-7e1f-4a2b-cc3d-4e5f60718293';
const OLD_TEMP = `.a.llsong.${UUID}.tmp`;
const FRESH_TEMP = `.b.llsong.${UUID}.tmp`;
const NOW = Date.now();
const TWO_MINUTES_AGO = (NOW - 120_000) / 1000;

async function writeOld(file: string): Promise<void> {
  await writeJson(file, 'leftover');
  await utimes(file, TWO_MINUTES_AGO, TWO_MINUTES_AGO);
}

describe('isTemporaryFileName', () => {
  it('knows only the names atomic writes give their temporary files', () => {
    expect(isTemporaryFileName(OLD_TEMP)).toBe(true);
    for (const name of [
      'a.llsong',
      'notes.tmp',
      '.a.llsong.tmp',
      `a.llsong.${UUID}.tmp`,
      `${OLD_TEMP}.bak`,
      `.a.llsong.${UUID.toUpperCase()}.tmp`,
      `.a.llsong.${NIL_UUID}.tmp`,
      `.a.llsong.${VERSION_1_UUID}.tmp`,
      `.a.llsong.${OTHER_VARIANT_UUID}.tmp`,
    ]) {
      expect(isTemporaryFileName(name)).toBe(false);
    }
  });
});

describe('removeStaleTempFiles', () => {
  it('removes old temporary files and keeps fresh ones and other files', async () => {
    const folder = await makeTempDir();
    await writeOld(join(folder, OLD_TEMP));
    await writeJson(join(folder, FRESH_TEMP), 'a write that runs now');
    await writeOld(join(folder, 'notes.tmp'));
    await writeOld(join(folder, 'a.llsong'));

    const problems = await removeStaleTempFiles(folder, NOW);

    expect(problems).toEqual([]);
    expect((await readdir(folder)).sort()).toEqual(
      [FRESH_TEMP, 'a.llsong', 'notes.tmp'].sort(),
    );
  });

  it('leaves files named with UUIDs that random writes never make', async () => {
    const folder = await makeTempDir();
    const names = [NIL_UUID, VERSION_1_UUID, OTHER_VARIANT_UUID].map(
      uuid => `.a.llsong.${uuid}.tmp`,
    );
    for (const name of names) {
      await writeOld(join(folder, name));
    }

    expect(await removeStaleTempFiles(folder, NOW)).toEqual([]);

    expect((await readdir(folder)).sort()).toEqual([...names].sort());
  });

  it('leaves a folder or a link with a temporary name alone', async () => {
    const folder = await makeTempDir();
    const elsewhere = await makeTempDir();
    await writeJson(join(elsewhere, 'keep.txt'), 'not ours');
    await mkdir(join(folder, OLD_TEMP));
    const link = join(folder, `.c.llsong.${UUID}.tmp`);
    await symlink(elsewhere, link, 'junction');
    onTestFinished(() => rm(link, {force: true}));

    expect(await removeStaleTempFiles(folder, NOW + 120_000)).toEqual([]);

    expect((await readdir(folder)).length).toBe(2);
    expect(await readdir(elsewhere)).toEqual(['keep.txt']);
  });

  it('reports a folder it cannot read', async () => {
    const folder = await makeTempDir();
    const notAFolder = join(folder, 'Songs');
    await writeJson(notAFolder, 'a file where the folder should be');

    expect(await removeStaleTempFiles(notAFolder, NOW)).toEqual([
      expect.objectContaining({file: notAFolder}),
    ]);
  });

  it('finds nothing in a folder that does not exist yet', async () => {
    const folder = await makeTempDir();

    expect(await removeStaleTempFiles(join(folder, 'Songs'), NOW)).toEqual([]);
  });
});
