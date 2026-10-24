import {existsSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it, onTestFinished} from 'vitest';
import {makeTempGitRepo} from './git-repo';

describe('makeTempGitRepo', () => {
  it('starts an empty repository on main with a local identity', async () => {
    const repo = await makeTempGitRepo();
    expect(repo.run(['symbolic-ref', '--short', 'HEAD'])).toBe('main');
    expect(repo.run(['config', '--local', 'user.email'])).toBe(
      'test@example.com',
    );
  });

  it('writes files and commits them with the given subject', async () => {
    const repo = await makeTempGitRepo();
    const hash = await repo.commit('docs(repo): add the readme', {
      'docs/README.md': '# Readme\n',
    });
    expect(repo.run(['log', '--format=%h %s'])).toBe(
      `${hash} docs(repo): add the readme`,
    );
    expect(await readFile(join(repo.path, 'docs/README.md'), 'utf8')).toBe(
      '# Readme\n',
    );
  });

  it('deletes the repository when the test finishes', async () => {
    let path = '';
    onTestFinished(() => {
      expect(existsSync(path)).toBe(false);
    });
    const repo = await makeTempGitRepo();
    path = repo.path;
    await repo.commit('chore(repo): start');
  });
});
