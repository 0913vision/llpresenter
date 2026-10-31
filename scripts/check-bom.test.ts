import {spawnSync} from 'node:child_process';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {makeTempGitRepo} from '../test/git-repo';
import {makeTempDir} from '../test/temp-dir';
import {findBomFiles, trackedTextFiles} from './check-bom.mts';

const SCRIPT = join(import.meta.dirname, 'check-bom.mts');

async function folderWith(
  files: Readonly<Record<string, string | Buffer>>,
): Promise<string> {
  const root = await makeTempDir();
  for (const [name, content] of Object.entries(files)) {
    await mkdir(dirname(join(root, name)), {recursive: true});
    await writeFile(join(root, name), content);
  }
  return root;
}

describe('findBomFiles', () => {
  it('finds the files that start with a BOM and leaves them unchanged', async () => {
    const root = await folderWith({
      'docs/공백 name.md': '﻿# Sample\n',
      'package-lock.json': '﻿{}\n',
      'clean.md': '# Clean\n',
    });
    const path = join(root, 'docs/공백 name.md');
    const before = await readFile(path);
    const files = ['docs/공백 name.md', 'package-lock.json', 'clean.md'];
    expect(await findBomFiles(root, files)).toEqual([
      'docs/공백 name.md',
      'package-lock.json',
    ]);
    expect(await readFile(path)).toEqual(before);
  });

  it('accepts empty, short, BOM-free Unicode, and a mark inside the text', async () => {
    const files = {
      'empty.json': '',
      'short.md': Buffer.from([0xef, 0xbb]),
      'docs/README.MD': '# 한글\n',
      'data/body.json': '{"text":"﻿inside"}\n',
    };
    const root = await folderWith(files);
    expect(await findBomFiles(root, Object.keys(files))).toEqual([]);
  });
});

// NOTE(0913vision): The tests below run git, once each: the file list and the
// command's wiring.
describe('trackedTextFiles', () => {
  it('lists tracked Markdown and JSON, even when Prettier ignores them', async () => {
    const repo = await makeTempGitRepo();
    await repo.commit('chore(repo): add encoding samples', {
      '.prettierignore': 'package-lock.json\n',
      'docs/공백 name.md': '# Sample\n',
      'docs/guide.markdown': '# Guide\n',
      'package-lock.json': '{}\n',
      'src/sample.ts': 'export const sample = 1;\n',
    });
    await repo.write({'docs/untracked.md': '# Not tracked\n'});
    expect([...trackedTextFiles(repo.path)].sort()).toEqual([
      'docs/guide.markdown',
      'docs/공백 name.md',
      'package-lock.json',
    ]);
  });

  it('fails outside a repository', async () => {
    const folder = await makeTempDir();
    expect(() => trackedTextFiles(folder)).toThrow(/git/);
  });
});

describe('the BOM check command', () => {
  it('names a tracked file with a BOM and exits with 1', async () => {
    const repo = await makeTempGitRepo();
    await repo.commit('chore(repo): add a Markdown sample', {
      'docs/sample.md': '﻿# Sample\n',
    });
    const result = spawnSync(process.execPath, [SCRIPT], {
      cwd: repo.path,
      encoding: 'utf8',
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('UTF-8 BOM: docs/sample.md');
  });
});
