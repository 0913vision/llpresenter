import {beforeEach, describe, expect, it, vi} from 'vitest';
import {makeTempGitRepo, type TempGitRepo} from '../../test/git-repo';
import {STAMP_PATH} from '../verify/stamp.mts';
import {
  checkMainPush,
  decideVerify,
  findMainUpdate,
  parseRefUpdates,
  runPrePush,
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
  ])('does not select %s', (_label, updates) => {
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
    '.gitignore': '.llp/\n',
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

  it('lets a tests-only commit through', async () => {
    const {repo, main} = await repoWithPush(
      'test(show): cover an empty service',
    );
    expect(checkMainPush(repo.path, main)).toBeNull();
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

describe('runPrePush', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  function branchUpdate(main: RefUpdate): RefUpdate {
    return {
      ...main,
      localRef: 'refs/heads/chore/devops/branch-ci',
      remoteRef: 'refs/heads/chore/devops/branch-ci',
    };
  }

  it('checks only messages for another branch, even with a different dirty checkout', async () => {
    const {repo, main} = await repoWithPush('feat(live): add undo');
    repo.run(['checkout', '--quiet', main.remoteSha]);
    await repo.write({'README.md': '# Changed\n'});
    const verify = vi.fn(() => true);
    expect(runPrePush(repo.path, [branchUpdate(main)], verify)).toBe(0);
    expect(verify).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('branch verify runs in GitHub Actions'),
    );
  });

  it('rejects invalid messages on another branch without running verify', async () => {
    const {repo, main} = await repoWithPush('Update stuff');
    const verify = vi.fn(() => true);
    expect(runPrePush(repo.path, [branchUpdate(main)], verify)).toBe(1);
    expect(verify).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('"Update stuff"'),
    );
  });

  it('rejects a branch commit with a body', async () => {
    const {repo, main} = await repoWithPush();
    repo.run([
      'commit',
      '--quiet',
      '--allow-empty',
      '-m',
      'fix(live): keep the last frame',
      '-m',
      'Extra line',
    ]);
    const branch = {
      ...branchUpdate(main),
      localSha: repo.run(['rev-parse', 'HEAD']),
    };
    const verify = vi.fn(() => true);
    expect(runPrePush(repo.path, [branch], verify)).toBe(1);
    expect(verify).not.toHaveBeenCalled();
  });

  it('checks new branch commits without checking history already on the remote', async () => {
    const {repo, main} = await repoWithPush('Old remote message');
    repo.run(['update-ref', 'refs/remotes/origin/main', main.localSha]);
    await repo.commit('chore(ci): verify branches on GitHub');
    const branch = {
      ...branchUpdate(main),
      localSha: repo.run(['rev-parse', 'HEAD']),
      remoteSha: NULL_SHA,
    };
    const verify = vi.fn(() => true);
    expect(runPrePush(repo.path, [branch], verify)).toBe(0);
    expect(verify).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    'runs main verification without a stamp and returns its result (%s)',
    async passes => {
      const {repo, main} = await repoWithPush('feat(live): add undo');
      const verify = vi.fn(() => passes);
      expect(runPrePush(repo.path, [main], verify)).toBe(passes ? 0 : 1);
      expect(verify).toHaveBeenCalledOnce();
    },
  );

  it('skips main verification when a clean stamp covers the pushed tree', async () => {
    const {repo, main} = await repoWithPush('feat(live): add undo');
    await repo.write({
      [STAMP_PATH]: JSON.stringify({
        v: 1,
        tree: repo.run(['rev-parse', `${main.localSha}^{tree}`]),
        clean: true,
        verifiedAt: '2026-10-25T03:00:00.000Z',
      }),
    });
    const verify = vi.fn(() => true);
    expect(runPrePush(repo.path, [main], verify)).toBe(0);
    expect(verify).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('verify skipped'),
    );
  });

  it('checks every branch before starting main verification in a mixed push', async () => {
    const {repo, main} = await repoWithPush('feat(live): add undo');
    await repo.commit('Bad branch message');
    const branch = {
      ...branchUpdate(main),
      localSha: repo.run(['rev-parse', 'HEAD']),
    };
    repo.run(['checkout', '--quiet', main.localSha]);
    const verify = vi.fn(() => true);
    expect(runPrePush(repo.path, [main, branch], verify)).toBe(1);
    expect(verify).not.toHaveBeenCalled();
  });

  it('ignores tags and branch deletions without reading git or running verify', () => {
    const verify = vi.fn(() => true);
    const updates = [
      update('refs/tags/v0.3.0'),
      update('refs/heads/main', NULL_SHA),
      update('refs/heads/chore/devops/old', NULL_SHA),
    ];
    expect(runPrePush('', updates, verify)).toBe(0);
    expect(verify).not.toHaveBeenCalled();
  });
});

describe('decideVerify', () => {
  async function writeStamp(
    repo: TempGitRepo,
    fields: {readonly tree: string; readonly clean: boolean},
  ): Promise<void> {
    await repo.write({
      [STAMP_PATH]: JSON.stringify({
        v: 1,
        ...fields,
        verifiedAt: '2026-10-25T03:00:00.000Z',
      }),
    });
  }

  it('skips verify for a tree that passed on a clean tree', async () => {
    const {repo, main} = await repoWithPush('feat(live): add undo');
    const tree = repo.run(['rev-parse', `${main.localSha}^{tree}`]);
    await writeStamp(repo, {tree, clean: true});
    expect(decideVerify(repo.path, main)).toMatchObject({
      kind: 'skip',
      stamp: {tree, clean: true},
    });
  });

  it('runs verify when the last pass checked another tree', async () => {
    const {repo, main} = await repoWithPush('feat(live): add undo');
    await writeStamp(repo, {tree: 'b'.repeat(40), clean: true});
    expect(decideVerify(repo.path, main)).toEqual({
      kind: 'run',
      reason: 'the last passing verify checked another tree',
    });
  });

  it('runs verify when the last pass had uncommitted changes', async () => {
    const {repo, main} = await repoWithPush('feat(live): add undo');
    const tree = repo.run(['rev-parse', `${main.localSha}^{tree}`]);
    await writeStamp(repo, {tree, clean: false});
    expect(decideVerify(repo.path, main)).toEqual({
      kind: 'run',
      reason: 'the last passing verify ran with uncommitted changes',
    });
  });

  it('runs verify without a stamp, or with one it cannot read', async () => {
    const {repo, main} = await repoWithPush('feat(live): add undo');
    expect(decideVerify(repo.path, main)).toEqual({
      kind: 'run',
      reason: 'no passing verify is recorded',
    });
    await repo.write({[STAMP_PATH]: '{"v": 1, "tree": '});
    expect(decideVerify(repo.path, main).kind).toBe('run');
  });
});
