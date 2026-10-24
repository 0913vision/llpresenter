import {readdir, readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {makeTempDir} from '../../../test/temp-dir';
import {writeFileAtomically} from './atomicWrite';

const renameFailures = vi.hoisted(() => {
  const codes: string[] = [];
  return {codes};
});

vi.mock('node:fs/promises', async importOriginal => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    rename: async (from: string, to: string) => {
      const code = renameFailures.codes.shift();
      if (code !== undefined) {
        throw Object.assign(new Error(`${code}: locked`), {code});
      }
      await actual.rename(from, to);
    },
  };
});

afterEach(() => {
  renameFailures.codes = [];
});

describe('writeFileAtomically on a locked file', () => {
  it('retries a rename that a short lock blocks', async () => {
    const folder = await makeTempDir();
    const file = join(folder, 'song.llsong');
    renameFailures.codes = ['EBUSY', 'EPERM'];

    expect((await writeFileAtomically(file, 'text')).ok).toBe(true);
    expect(await readFile(file, 'utf8')).toBe('text');
  });

  it('gives up after the retries and cleans up', async () => {
    const folder = await makeTempDir();
    const file = join(folder, 'song.llsong');
    renameFailures.codes = ['EBUSY', 'EBUSY', 'EBUSY', 'EBUSY', 'EBUSY'];

    const result = await writeFileAtomically(file, 'text');

    expect(result.ok ? undefined : result.error.message).toContain('EBUSY');
    expect(await readdir(folder)).toEqual([]);
  });

  it('does not retry an error that is not a lock', async () => {
    const folder = await makeTempDir();
    renameFailures.codes = ['ENOSPC', 'EBUSY'];

    const result = await writeFileAtomically(join(folder, 'a.json'), 'text');

    expect(result.ok ? undefined : result.error.message).toContain('ENOSPC');
    expect(renameFailures.codes).toEqual(['EBUSY']);
  });
});
