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
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {fileIo} from './fileIo';

let dir = '';

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'llp-file-io-'));
});

afterEach(async () => {
  await rm(dir, {recursive: true, force: true});
});

describe('fileIo.read', () => {
  it('reads the text of a file', async () => {
    const file = join(dir, 'app.json');
    await writeFile(file, '{"a":1}');
    expect(await fileIo.read(file)).toBe('{"a":1}');
  });

  it('reads a missing file as null', async () => {
    expect(await fileIo.read(join(dir, 'missing.json'))).toBeNull();
  });

  it('rejects for an error other than a missing file', async () => {
    await mkdir(join(dir, 'folder'));
    await expect(fileIo.read(join(dir, 'folder'))).rejects.toThrow();
  });
});

describe('fileIo.write', () => {
  it('writes the file with the text and leaves no temporary file', async () => {
    const file = join(dir, 'app.json');
    await fileIo.write(file, 'text');
    expect(await readFile(file, 'utf8')).toBe('text');
    expect(await readdir(dir)).toEqual(['app.json']);
  });

  it('replaces an existing file', async () => {
    const file = join(dir, 'app.json');
    await writeFile(file, 'old');
    await fileIo.write(file, 'new');
    expect(await readFile(file, 'utf8')).toBe('new');
  });

  it('creates the folder when it is missing', async () => {
    const file = join(dir, 'nested', 'app.json');
    await fileIo.write(file, 'text');
    expect(await readFile(file, 'utf8')).toBe('text');
  });

  it('rejects with the reason and keeps the original when the write fails', async () => {
    const target = join(dir, 'app.json');
    await mkdir(target);
    await writeFile(join(target, 'keep.txt'), 'kept');
    await expect(fileIo.write(target, 'new')).rejects.toThrow();
    expect(await readdir(dir)).toEqual(['app.json']);
    expect(await readFile(join(target, 'keep.txt'), 'utf8')).toBe('kept');
  });
});
