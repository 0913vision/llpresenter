import {readdir, readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {makeTempDir} from '../../../test/temp-dir';
import {writeFileAtomically} from './atomicWrite';

describe('writeFileAtomically', () => {
  it('writes the text and leaves no temporary file', async () => {
    const folder = await makeTempDir();
    const file = join(folder, 'song.llsong');

    const result = await writeFileAtomically(file, '{"title":"만복의 근원"}\n');

    expect(result).toEqual({ok: true, value: undefined});
    expect(await readFile(file, 'utf8')).toBe('{"title":"만복의 근원"}\n');
    expect(await readdir(folder)).toEqual(['song.llsong']);
  });

  it('writes bytes as they are', async () => {
    const folder = await makeTempDir();
    const file = join(folder, 'thumbnail.jpg');
    const bytes = Uint8Array.from([0xff, 0xd8, 0x00, 0xff, 0xd9]);

    await writeFileAtomically(file, bytes);

    expect(new Uint8Array(await readFile(file))).toEqual(bytes);
  });

  it('replaces the old content', async () => {
    const folder = await makeTempDir();
    const file = join(folder, 'app.json');
    await writeFile(file, 'old');

    await writeFileAtomically(file, 'new');

    expect(await readFile(file, 'utf8')).toBe('new');
  });

  it('creates a missing folder', async () => {
    const folder = await makeTempDir();
    const file = join(folder, '곡', 'song.llsong');

    expect((await writeFileAtomically(file, 'text')).ok).toBe(true);
    expect(await readFile(file, 'utf8')).toBe('text');
  });

  it('reports a failure, keeps the old file, and leaves no temporary file', async () => {
    const folder = await makeTempDir();
    const blocker = join(folder, 'not-a-folder');
    await writeFile(blocker, 'a file where a folder should be');
    const file = join(blocker, 'song.llsong');

    const result = await writeFileAtomically(file, 'text');

    expect(result.ok ? undefined : result.error.file).toBe(file);
    expect(await readdir(folder)).toEqual(['not-a-folder']);
    expect(await readFile(blocker, 'utf8')).toBe(
      'a file where a folder should be',
    );
  });
});
