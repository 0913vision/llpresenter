import {existsSync} from 'node:fs';
import {readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {makeTempGitRepo, type TempGitRepo} from '../../test/git-repo';
import {
  beginStamp,
  parseStamp,
  readStamp,
  STAMP_PATH,
  stampFor,
} from './stamp.mts';

const NOW = new Date('2026-10-25T03:00:00.000Z');
const TREE = 'a'.repeat(40);

// NOTE(0913vision): The repository ignores .llp/ as the real one does, so the
// stamp itself never makes the working tree look changed.
async function cleanRepo(): Promise<TempGitRepo> {
  const repo = await makeTempGitRepo();
  await repo.commit('chore(repo): start the project', {
    '.gitignore': '.llp/\n',
    'README.md': '# Test\n',
  });
  return repo;
}

describe('beginStamp', () => {
  it('records the tree and a clean working tree after a passing run', async () => {
    const repo = await cleanRepo();
    const finish = await beginStamp(repo.path, () => NOW);
    await finish(0);
    expect(readStamp(repo.path)).toEqual({
      tree: repo.run(['rev-parse', 'HEAD^{tree}']),
      clean: true,
      verifiedAt: NOW.toISOString(),
    });
  });

  it('writes no stamp after a failed run and removes an old one', async () => {
    const repo = await cleanRepo();
    const old = await beginStamp(repo.path, () => NOW);
    await old(0);
    expect(existsSync(join(repo.path, STAMP_PATH))).toBe(true);
    const finish = await beginStamp(repo.path, () => NOW);
    await finish(1);
    expect(existsSync(join(repo.path, STAMP_PATH))).toBe(false);
  });

  it('removes the previous passing stamp even when git state capture fails', async () => {
    const repo = await cleanRepo();
    const finish = await beginStamp(repo.path, () => NOW);
    await finish(0);
    expect(readStamp(repo.path)?.clean).toBe(true);
    const headPath = join(repo.path, '.git', 'HEAD');
    const head = await readFile(headPath, 'utf8');
    await writeFile(headPath, 'ref: refs/heads/missing\n');
    try {
      await expect(beginStamp(repo.path, () => NOW)).rejects.toThrow(
        'git rev-parse',
      );
    } finally {
      await writeFile(headPath, head);
    }
    expect(readStamp(repo.path)).toBeNull();
    expect(existsSync(join(repo.path, STAMP_PATH))).toBe(false);
  });

  it('records a run with uncommitted changes as not clean', async () => {
    const repo = await cleanRepo();
    await repo.write({'README.md': '# Changed\n'});
    const finish = await beginStamp(repo.path, () => NOW);
    await finish(0);
    expect(readStamp(repo.path)?.clean).toBe(false);
  });

  it('writes the stamp in full, never half', async () => {
    const repo = await cleanRepo();
    const finish = await beginStamp(repo.path, () => NOW);
    await finish(0);
    const text = await readFile(join(repo.path, STAMP_PATH), 'utf8');
    expect(parseStamp(text)).not.toBeNull();
    expect(existsSync(join(repo.path, `${STAMP_PATH}.tmp`))).toBe(false);
  });
});

describe('stampFor', () => {
  const clean = {tree: TREE, clean: true};

  it('is clean when the tree stayed the same and clean', () => {
    expect(stampFor(clean, clean, NOW).clean).toBe(true);
  });

  it('is not clean when the tree changed during the run', () => {
    expect(
      stampFor(clean, {tree: 'b'.repeat(40), clean: true}, NOW).clean,
    ).toBe(false);
  });

  it('is not clean when the working tree changed during the run', () => {
    expect(stampFor(clean, {tree: TREE, clean: false}, NOW).clean).toBe(false);
  });
});

describe('parseStamp', () => {
  it.each([
    ['text that is not JSON', 'stamp'],
    [
      'another version',
      JSON.stringify({v: 2, tree: TREE, clean: true, verifiedAt: 'x'}),
    ],
    [
      'a tree that is not a hash',
      JSON.stringify({v: 1, tree: 'main', clean: true, verifiedAt: 'x'}),
    ],
    ['no clean flag', JSON.stringify({v: 1, tree: TREE, verifiedAt: 'x'})],
  ])('refuses %s', (_label, text) => {
    expect(parseStamp(text)).toBeNull();
  });

  it('reads no stamp from a folder without one', async () => {
    const repo = await cleanRepo();
    await writeFile(join(repo.path, 'other.json'), '{}');
    expect(readStamp(repo.path)).toBeNull();
  });
});
