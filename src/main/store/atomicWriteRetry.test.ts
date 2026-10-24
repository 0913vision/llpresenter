import {readdir, readFile} from 'node:fs/promises';
import {basename, join} from 'node:path';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {makeTempDir} from '../../../test/temp-dir';
import {isTemporaryFileName, writeFileAtomically} from './atomicWrite';

const renameFailures = vi.hoisted(() => {
  const codes: string[] = [];
  const renamed: string[] = [];
  return {codes, renamed};
});

vi.mock('node:fs/promises', async importOriginal => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    rename: async (from: string, to: string) => {
      renameFailures.renamed.push(from);
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
  renameFailures.renamed = [];
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

  it('gives its temporary file a name the leftover cleanup knows', async () => {
    const folder = await makeTempDir();

    await writeFileAtomically(join(folder, 'song.llsong'), 'text');

    expect(renameFailures.renamed.map(from => basename(from))).toEqual([
      expect.stringMatching(/^\.song\.llsong\./),
    ]);
    expect(isTemporaryFileName(basename(renameFailures.renamed[0] ?? ''))).toBe(
      true,
    );
  });
});
