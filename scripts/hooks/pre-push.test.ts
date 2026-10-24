import {describe, expect, it} from 'vitest';
import {makeTempGitRepo, type TempGitRepo} from '../../test/git-repo';
import {
  checkMainPush,
  findMainUpdate,
  parseRefUpdates,
  type RefUpdate,
} from './pre-push.mts';

const NULL_SHA = '0000000000000000000000000000000000000000';
const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);

function update(remoteRef: string, localSha = SHA_A): RefUpdate {
  return {localRef: remoteRef, localSha, remoteRef, remoteSha: SHA_B};
}

describe('parseRefUpdates', () => {
  it('reads one update per line and skips blank lines', () => {
    const input = [
      `refs/heads/main ${SHA_A} refs/heads/main ${SHA_B}`,
      '',
      `refs/tags/v0.3.0 ${SHA_B} refs/tags/v0.3.0 ${NULL_SHA}\r`,
    ].join('\n');
    expect(parseRefUpdates(input)).toEqual([
      {
        localRef: 'refs/heads/main',
        localSha: SHA_A,
        remoteRef: 'refs/heads/main',
        remoteSha: SHA_B,
      },
      {
        localRef: 'refs/tags/v0.3.0',
        localSha: SHA_B,
        remoteRef: 'refs/tags/v0.3.0',
        remoteSha: NULL_SHA,
      },
    ]);
  });
});

describe('findMainUpdate', () => {
  it('finds a push to main', () => {
    const main = update('refs/heads/main');
    expect(findMainUpdate([update('refs/tags/v0.3.0'), main])).toBe(main);
  });

  it.each([
    ['a tag', [update('refs/tags/v0.3.0')]],
    ['another branch', [update('refs/heads/feat/ui/form-controls')]],
    ['deleting main', [update('refs/heads/main', NULL_SHA)]],
  ])('lets %s through without a check', (_label, updates) => {
    expect(findMainUpdate(updates)).toBeNull();
  });
});

interface PushedRepo {
  readonly repo: TempGitRepo;
  readonly main: RefUpdate;
}

async function repoWithPush(...subjects: string[]): Promise<PushedRepo> {
  const repo = await makeTempGitRepo();
  await repo.commit('chore(repo): start the project', {
    'README.md': '# Test\n',
  });
  const remoteSha = repo.run(['rev-parse', 'HEAD']);
  for (const subject of subjects) await repo.commit(subject);
  const localSha = repo.run(['rev-parse', 'HEAD']);
  return {
    repo,
    main: {
      localRef: 'refs/heads/main',
      localSha,
      remoteRef: 'refs/heads/main',
      remoteSha,
    },
  };
}

describe('checkMainPush', () => {
  it('lets valid commits and the bot bump commit through', async () => {
    const {repo, main} = await repoWithPush(
      'feat(live): add undo',
      'Bump version: 0.3.0',
    );
    expect(checkMainPush(repo.path, main)).toBeNull();
  });

  it('checks every commit when main is new on the remote', async () => {
    const {repo, main} = await repoWithPush('feat(live): add undo');
    expect(checkMainPush(repo.path, {...main, remoteSha: NULL_SHA})).toBeNull();
  });

  it('lists the commits whose messages break the format', async () => {
    const {repo, main} = await repoWithPush(
      'feat(live): add undo',
      'Update stuff',
      'bump version: 0.3.0',
    );
    const problem = checkMainPush(repo.path, main);
    expect(problem).toMatch(/^fix these commit messages first: /);
    expect(problem).toContain('"Update stuff"');
    expect(problem).toContain('"bump version: 0.3.0"');
    expect(problem).not.toContain('add undo');
  });

  it('stops a commit with a body or trailers', async () => {
    const {repo, main} = await repoWithPush();
    repo.run([
      'commit',
      '--quiet',
      '--allow-empty',
      '-m',
      'fix(live): keep the last frame',
      '-m',
      'Co-Authored-By: Someone <someone@example.com>',
    ]);
    const pushed = {...main, localSha: repo.run(['rev-parse', 'HEAD'])};
    expect(checkMainPush(repo.path, pushed)).toMatch(/has a body or trailers/);
  });

  it('stops a second line written without a blank line before it', async () => {
    const {repo, main} = await repoWithPush();
    repo.run([
      'commit',
      '--quiet',
      '--allow-empty',
      '-m',
      'fix(live): keep the last frame\nand the one before it',
    ]);
    const pushed = {...main, localSha: repo.run(['rev-parse', 'HEAD'])};
    expect(checkMainPush(repo.path, pushed)).toMatch(/has a body or trailers/);
  });

  it('stops when the pushed commit is not checked out', async () => {
    const {repo, main} = await repoWithPush('feat(live): add undo');
    repo.run(['checkout', '--quiet', main.remoteSha]);
    expect(checkMainPush(repo.path, main)).toMatch(/^check out the main/);
  });

  it('stops when the working tree has changes', async () => {
    const {repo, main} = await repoWithPush('feat(live): add undo');
    await repo.write({'README.md': '# Changed\n'});
    expect(checkMainPush(repo.path, main)).toMatch(/^commit or stash/);
  });

  it('stops when origin has a commit this clone lacks', async () => {
    const {repo, main} = await repoWithPush('feat(live): add undo');
    expect(checkMainPush(repo.path, {...main, remoteSha: SHA_B})).toMatch(
      /pull the version bot commit first/,
    );
  });

  it('stops when main on origin went another way', async () => {
    const {repo, main} = await repoWithPush('feat(live): add undo');
    repo.run(['checkout', '--quiet', '-b', 'bot', main.remoteSha]);
    await repo.commit('Bump version: 0.3.0');
    const botCommit = repo.run(['rev-parse', 'HEAD']);
    repo.run(['checkout', '--quiet', 'main']);
    expect(checkMainPush(repo.path, {...main, remoteSha: botCommit})).toMatch(
      /pull the version bot commit first/,
    );
  });
});
