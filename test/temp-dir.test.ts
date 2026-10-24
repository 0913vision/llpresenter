import {existsSync} from 'node:fs';
import {readdir, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, relative} from 'node:path';
import {describe, expect, it, onTestFinished} from 'vitest';
import {makeTempDir} from './temp-dir';

describe('makeTempDir', () => {
  it('creates an empty folder under the system temp folder', async () => {
    const path = await makeTempDir();
    expect(relative(tmpdir(), path).startsWith('..')).toBe(false);
    expect(await readdir(path)).toEqual([]);
  });

  it('gives each call its own folder', async () => {
    const first = await makeTempDir();
    const second = await makeTempDir();
    expect(first).not.toBe(second);
  });

  it('deletes the folder and its files when the test finishes', async () => {
    let path = '';
    onTestFinished(() => {
      expect(existsSync(path)).toBe(false);
    });
    path = await makeTempDir();
    await writeFile(join(path, 'song.llsong'), '{}');
    expect(existsSync(path)).toBe(true);
  });
});
