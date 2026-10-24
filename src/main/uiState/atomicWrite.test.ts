import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

const failures = vi.hoisted(() => ({sync: false}));

vi.mock('node:fs/promises', async importOriginal => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    open: async (...args: Parameters<typeof actual.open>) => {
      const handle = await actual.open(...args);
      if (failures.sync) {
        Object.assign(handle, {
          sync: () => Promise.reject(new Error('sync failed')),
        });
      }
      return handle;
    },
  };
});

const {writeFileAtomic} = await import('./atomicWrite');

let dir = '';

beforeEach(async () => {
  failures.sync = false;
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

  it('fails before any temporary file exists when the folder cannot be made', async () => {
    const file = join(dir, 'app.json');
    await writeFile(file, 'old');
    await expect(
      writeFileAtomic(join(file, 'inside'), 'new'),
    ).rejects.toThrow();
    expect(await readFile(file, 'utf8')).toBe('old');
    expect(await readdir(dir)).toEqual(['app.json']);
  });

  it('overwrites a stale temporary file from an earlier crash', async () => {
    const file = join(dir, 'app.json');
    await writeFile(file, 'old');
    await writeFile(
      `${file}.tmp`,
      'half written text from a crash that is longer',
    );
    await writeFileAtomic(file, 'new');
    expect(await readFile(file, 'utf8')).toBe('new');
    expect(await readdir(dir)).toEqual(['app.json']);
  });

  it('removes a stale temporary file when the write then fails', async () => {
    const file = join(dir, 'app.json');
    await writeFile(file, 'old');
    await writeFile(`${file}.tmp`, 'stale');
    failures.sync = true;
    await expect(writeFileAtomic(file, 'new')).rejects.toThrow('sync failed');
    expect(await readFile(file, 'utf8')).toBe('old');
    expect(await readdir(dir)).toEqual(['app.json']);
  });
});

describe('writeFileAtomic when a step fails after the temporary file exists', () => {
  it('keeps the original, removes the temporary file, and rejects when the flush fails', async () => {
    const file = join(dir, 'app.json');
    await writeFile(file, 'old');
    failures.sync = true;
    await expect(writeFileAtomic(file, 'new')).rejects.toThrow('sync failed');
    expect(await readFile(file, 'utf8')).toBe('old');
    expect(await readdir(dir)).toEqual(['app.json']);
  });

  it('creates no file when the flush fails for a file that did not exist', async () => {
    const file = join(dir, 'app.json');
    failures.sync = true;
    await expect(writeFileAtomic(file, 'new')).rejects.toThrow('sync failed');
    expect(await readdir(dir)).toEqual([]);
  });

  it('keeps the original, removes the temporary file, and rejects when the rename fails', async () => {
    const target = join(dir, 'app.json');
    await mkdir(target);
    await writeFile(join(target, 'keep.txt'), 'kept');
    await expect(writeFileAtomic(target, 'new')).rejects.toThrow();
    expect(await readdir(dir)).toEqual(['app.json']);
    expect(await readdir(target)).toEqual(['keep.txt']);
    expect(await readFile(join(target, 'keep.txt'), 'utf8')).toBe('kept');
  });
});
