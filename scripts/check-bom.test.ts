import {spawnSync} from 'node:child_process';
import {readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {makeTempGitRepo} from '../test/git-repo';
import {makeTempDir} from '../test/temp-dir';
import {findBomFiles} from './check-bom.mts';

const SCRIPT = join(import.meta.dirname, 'check-bom.mts');

describe('findBomFiles', () => {
  it('checks tracked Markdown and JSON even when Prettier ignores them', async () => {
    const repo = await makeTempGitRepo();
    await repo.commit('chore(repo): add encoding samples', {
      '.prettierignore': 'package-lock.json\n',
      'docs/공백 name.md': '\uFEFF# Sample\n',
      'package-lock.json': '\uFEFF{}\n',
      'src/sample.ts': '\uFEFFexport const sample = 1;\n',
    });
    await repo.write({'docs/untracked.md': '\uFEFF# Not tracked\n'});
    const path = join(repo.path, 'docs/공백 name.md');
    const before = await readFile(path);
    expect(await findBomFiles(repo.path)).toEqual([
      'docs/공백 name.md',
      'package-lock.json',
    ]);
    expect(await readFile(path)).toEqual(before);
  });

  it('accepts empty, short, BOM-free Unicode, and a mark inside the text', async () => {
    const repo = await makeTempGitRepo();
    await repo.commit('chore(repo): add clean encoding samples', {
      'empty.json': '',
      'docs/README.MD': '# 한글\n',
      'docs/sample.markdown': '# Text\n',
      'data/body.json': '{"text":"\uFEFFinside"}\n',
    });
    await writeFile(join(repo.path, 'short.md'), Buffer.from([0xef, 0xbb]));
    repo.run(['add', 'short.md']);
    expect(await findBomFiles(repo.path)).toEqual([]);
  });
});

describe('the BOM check command', () => {
  it.each([
    {text: '# Clean\n', code: 0, output: 'No UTF-8 BOMs'},
    {text: '\uFEFF# Sample\n', code: 1, output: 'UTF-8 BOM: docs/sample.md'},
  ])(
    'returns $code for a tracked Markdown sample',
    async ({text, code, output}) => {
      const repo = await makeTempGitRepo();
      await repo.commit('chore(repo): add a Markdown sample', {
        'docs/sample.md': text,
      });
      const result = spawnSync(process.execPath, [SCRIPT], {
        cwd: repo.path,
        encoding: 'utf8',
      });
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(code);
      expect(result.stdout + result.stderr).toContain(output);
    },
  );

  it('fails when the tracked-file list cannot be read', async () => {
    const result = spawnSync(process.execPath, [SCRIPT], {
      cwd: await makeTempDir(),
      encoding: 'utf8',
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('BOM check failed:');
  });
});
