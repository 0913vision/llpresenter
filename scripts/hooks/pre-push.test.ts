import {beforeEach, describe, expect, it, vi} from 'vitest';
import {makeTempGitRepo, type TempGitRepo} from '../../test/git-repo';
import {STAMP_PATH} from '../verify/stamp.mts';
import type {CommitMessage} from '../version/commits.mts';
import {
  checkMainPush,
  decideVerify,
  findMainUpdate,
  parseRefUpdates,
  repositoryAt,
  runPrePush,
  type PushedRepository,
  type RefUpdate,
} from './pre-push.mts';

const NULL_SHA = '0000000000000000000000000000000000000000';
const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);
const TREE = 'c'.repeat(40);
const STAMPED_AT = '2026-10-25T03:00:00.000Z';

function update(remoteRef: string, localSha = SHA_A): RefUpdate {
  return {localRef: remoteRef, localSha, remoteRef, remoteSha: SHA_B};
}

const MAIN = update('refs/heads/main');
const BRANCH = update('refs/heads/chore/devops/branch-ci');

function message(subject: string, body = ''): CommitMessage {
  return {hash: subject.slice(0, 7), subject, body};
}

/** A repository whose main is checked out, clean, and ahead of origin. */
function mockRepository(
  parts: Partial<PushedRepository> = {},
): PushedRepository {
  return {
    head: () => SHA_A,
    isClean: () => true,
    isAncestor: () => true,
    treeOf: () => TREE,
    messages: () => [message('feat(live): add undo')],
    stamp: () => null,
    ...parts,
  };
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
    expect(findMainUpdate([update('refs/tags/v0.3.0'), MAIN])).toBe(MAIN);
  });

  it.each([
    ['a tag', [update('refs/tags/v0.3.0')]],
    ['another branch', [BRANCH]],
    ['deleting main', [update('refs/heads/main', NULL_SHA)]],
  ])('does not select %s', (_label, updates) => {
    expect(findMainUpdate(updates)).toBeNull();
  });
});

describe('checkMainPush', () => {
  it('lets valid commits, a tests-only commit, and the bot bump through', () => {
    const repo = mockRepository({
      messages: () => [
        message('feat(live): add undo'),
        message('test(show): cover an empty service'),
        message('Bump version: 0.3.0'),
      ],
    });
    expect(checkMainPush(repo, MAIN)).toBeNull();
  });

  it('reads every commit not on a remote when main is new there', () => {
    const messages = vi.fn(() => [message('feat(live): add undo')]);
    const repo = mockRepository({messages});
    expect(checkMainPush(repo, {...MAIN, remoteSha: NULL_SHA})).toBeNull();
    expect(messages).toHaveBeenCalledWith([SHA_A, '--not', '--remotes']);
  });

  it('lists the commits whose messages break the format', () => {
    const repo = mockRepository({
      messages: () => [
        message('feat(live): add undo'),
        message('Update stuff'),
        message('bump version: 0.3.0'),
      ],
    });
    const problem = checkMainPush(repo, MAIN);
    expect(problem).toMatch(/^fix these commit messages first: /);
    expect(problem).toContain('"Update stuff"');
    expect(problem).toContain('"bump version: 0.3.0"');
    expect(problem).not.toContain('add undo');
  });

  it('stops a commit with a body or trailers', () => {
    const repo = mockRepository({
      messages: () => [
        message('fix(live): keep the last frame', 'Co-Authored-By: Someone'),
      ],
    });
    expect(checkMainPush(repo, MAIN)).toMatch(/has a body or trailers/);
  });

  it('stops when the pushed commit is not checked out', () => {
    const repo = mockRepository({head: () => SHA_B});
    expect(checkMainPush(repo, MAIN)).toMatch(/^check out the main/);
  });

  it('stops when the working tree has changes', () => {
    const repo = mockRepository({isClean: () => false});
    expect(checkMainPush(repo, MAIN)).toMatch(/^commit or stash/);
  });

  it('stops when origin has commits this push lacks', () => {
    const repo = mockRepository({isAncestor: () => false});
    expect(checkMainPush(repo, MAIN)).toMatch(
      /pull the version bot commit first/,
    );
  });
});

describe('decideVerify', () => {
  function stamped(tree: string, clean: boolean): PushedRepository {
    return mockRepository({
      stamp: () => ({tree, clean, verifiedAt: STAMPED_AT}),
    });
  }

  it('skips verify for a tree that passed on a clean tree', () => {
    expect(decideVerify(stamped(TREE, true), MAIN)).toMatchObject({
      kind: 'skip',
      stamp: {tree: TREE, clean: true},
    });
  });

  it('runs verify when the last pass checked another tree', () => {
    expect(decideVerify(stamped(SHA_B, true), MAIN)).toEqual({
      kind: 'run',
      reason: 'the last passing verify checked another tree',
    });
  });

  it('runs verify when the last pass had uncommitted changes', () => {
    expect(decideVerify(stamped(TREE, false), MAIN)).toEqual({
      kind: 'run',
      reason: 'the last passing verify ran with uncommitted changes',
    });
  });

  it('runs verify without a stamp', () => {
    expect(decideVerify(mockRepository(), MAIN)).toEqual({
      kind: 'run',
      reason: 'no passing verify is recorded',
    });
  });
});

describe('runPrePush', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('checks only messages for another branch, whatever is checked out', () => {
    const repo = mockRepository({head: () => SHA_B, isClean: () => false});
    const verify = vi.fn(() => true);
    expect(runPrePush(repo, [BRANCH], verify)).toBe(0);
    expect(verify).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('branch verify runs in GitHub Actions'),
    );
  });

  it('rejects a bad message on another branch without running verify', () => {
    const repo = mockRepository({messages: () => [message('Update stuff')]});
    const verify = vi.fn(() => true);
    expect(runPrePush(repo, [BRANCH], verify)).toBe(1);
    expect(verify).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('"Update stuff"'),
    );
  });

  it.each([true, false])(
    'runs main verification without a stamp and returns its result (%s)',
    passes => {
      const verify = vi.fn(() => passes);
      expect(runPrePush(mockRepository(), [MAIN], verify)).toBe(passes ? 0 : 1);
      expect(verify).toHaveBeenCalledOnce();
    },
  );

  it('skips main verification when a clean stamp covers the pushed tree', () => {
    const repo = mockRepository({
      stamp: () => ({tree: TREE, clean: true, verifiedAt: STAMPED_AT}),
    });
    const verify = vi.fn(() => true);
    expect(runPrePush(repo, [MAIN], verify)).toBe(0);
    expect(verify).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('verify skipped'),
    );
  });

  it('checks every branch before starting main verification in a mixed push', () => {
    const repo = mockRepository({
      messages: revisions =>
        revisions.some(revision => revision.endsWith(SHA_B))
          ? [message('Bad branch message')]
          : [message('feat(live): add undo')],
    });
    const branch = {...BRANCH, localSha: SHA_B, remoteSha: SHA_A};
    const verify = vi.fn(() => true);
    expect(runPrePush(repo, [MAIN, branch], verify)).toBe(1);
    expect(verify).not.toHaveBeenCalled();
  });

  it('ignores tags and branch deletions without reading the repository', () => {
    const untouched = (): never => {
      throw new Error('The hook read the repository');
    };
    const repo: PushedRepository = {
      head: untouched,
      isClean: untouched,
      isAncestor: untouched,
      treeOf: untouched,
      messages: untouched,
      stamp: untouched,
    };
    const verify = vi.fn(() => true);
    const updates = [
      update('refs/tags/v0.3.0'),
      update('refs/heads/main', NULL_SHA),
      update('refs/heads/chore/devops/old', NULL_SHA),
    ];
    expect(runPrePush(repo, updates, verify)).toBe(0);
    expect(verify).not.toHaveBeenCalled();
  });
});

// NOTE(0913vision): The only tests here that run git. They prove that the real
// repository answers what the hook asks, on one throwaway repository each.
describe('repositoryAt', () => {
  async function startedRepo(): Promise<{
    readonly repo: TempGitRepo;
    readonly base: string;
  }> {
    const repo = await makeTempGitRepo();
    await repo.commit('chore(repo): start the project', {
      '.gitignore': '.llp/\n',
      'README.md': '# Test\n',
    });
    return {repo, base: repo.run(['rev-parse', 'HEAD'])};
  }

  function commitRaw(repo: TempGitRepo, ...messages: string[]): void {
    repo.run([
      'commit',
      '--quiet',
      '--allow-empty',
      ...messages.flatMap(text => ['-m', text]),
    ]);
  }

  it('reads the head, the tree, ancestry, and a changed working tree', async () => {
    const {repo, base} = await startedRepo();
    await repo.commit('feat(live): add undo');
    const read = repositoryAt(repo.path);
    const head = repo.run(['rev-parse', 'HEAD']);
    expect(read.head()).toBe(head);
    expect(read.treeOf(head)).toBe(repo.run(['rev-parse', 'HEAD^{tree}']));
    expect(read.isAncestor(base, head)).toBe(true);
    expect(read.isAncestor(head, base)).toBe(false);
    expect(read.isClean()).toBe(true);
    await repo.write({'README.md': '# Changed\n'});
    expect(read.isClean()).toBe(false);
  });

  it('reads subjects, bodies, a second line, and the verify stamp', async () => {
    const {repo, base} = await startedRepo();
    await repo.commit('feat(live): add undo');
    commitRaw(
      repo,
      'fix(live): keep the last frame',
      'Co-Authored-By: Someone <someone@example.com>',
    );
    commitRaw(repo, 'fix(live): keep the frame\nand the one before it');
    const read = repositoryAt(repo.path);
    const head = read.head();
    const messages = read.messages([`${base}..${head}`]);
    expect(messages.map(({subject, body}) => [subject, body !== ''])).toEqual([
      ['fix(live): keep the frame', true],
      ['fix(live): keep the last frame', true],
      ['feat(live): add undo', false],
    ]);
    expect(read.stamp()).toBeNull();
    const tree = read.treeOf(head);
    await repo.write({
      [STAMP_PATH]: JSON.stringify({
        v: 1,
        tree,
        clean: true,
        verifiedAt: STAMPED_AT,
      }),
    });
    expect(read.stamp()).toEqual({tree, clean: true, verifiedAt: STAMPED_AT});
  });
});
