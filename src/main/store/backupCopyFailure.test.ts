import {mkdir, readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {makeTempDir} from '../../../test/temp-dir';
import {runBackup} from './backup';
import {resolveLocations} from './locations';
import {writeJson} from './testFiles';

const copyFailures = vi.hoisted(() => {
  const codes: string[] = [];
  return {codes};
});

vi.mock('node:fs/promises', async importOriginal => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    cp: async (...args: Parameters<typeof actual.cp>) => {
      const code = copyFailures.codes.shift();
      if (code !== undefined) {
        throw Object.assign(new Error(`${code}: a file vanished`), {code});
      }
      await actual.cp(...args);
    },
  };
});

afterEach(() => {
  copyFailures.codes = [];
});

describe('runBackup when a copy fails halfway', () => {
  it('fails the backup and keeps the older backups', async () => {
    const folder = await makeTempDir();
    const {locations} = resolveLocations(
      {},
      {documents: join(folder, 'unused'), developmentFolder: folder},
    );
    await writeJson(join(locations.songs, 'a.llsong'), {title: 'a'});
    const older = '2026-10-24 210000';
    await mkdir(join(locations.backups, older), {recursive: true});
    copyFailures.codes = ['ENOENT'];

    const backup = await runBackup({
      locations,
      keep: 1,
      now: new Date(2026, 9, 25, 7, 58, 0),
    });

    expect(backup).toMatchObject({
      ok: false,
      error: {message: 'ENOENT: a file vanished'},
    });
    expect(await readdir(locations.backups)).toEqual([older]);
  });
});
