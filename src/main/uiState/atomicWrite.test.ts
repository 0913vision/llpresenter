import {mkdtemp, readdir, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {writeFileAtomic} from './atomicWrite';

let dir = '';

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'llp-atomic-'));
});

afterEach(async () => {
  await rm(dir, {recursive: true, force: true});
});

describe('writeFileAtomic', () => {
  it('creates the file with the text', async () => {
    const file = join(dir, 'app.json');
    await writeFileAtomic(file, '{"a":1}\n');
    expect(await readFile(file, 'utf8')).toBe('{"a":1}\n');
  });

  it('replaces an existing file and leaves no temporary file', async () => {
    const file = join(dir, 'app.json');
    await writeFile(file, 'old');
    await writeFileAtomic(file, 'new');
    expect(await readFile(file, 'utf8')).toBe('new');
    expect(await readdir(dir)).toEqual(['app.json']);
  });

  it('creates the folder when it does not exist', async () => {
    const file = join(dir, 'nested', 'app.json');
    await writeFileAtomic(file, 'text');
    expect(await readFile(file, 'utf8')).toBe('text');
  });

  it('keeps the old file when the target cannot be replaced', async () => {
    const file = join(dir, 'app.json');
    await writeFile(file, 'old');
    await expect(
      writeFileAtomic(join(file, 'inside'), 'new'),
    ).rejects.toThrow();
    expect(await readFile(file, 'utf8')).toBe('old');
    expect(await readdir(dir)).toEqual(['app.json']);
  });
});
