import {beforeEach, describe, expect, it, vi} from 'vitest';
import {makeTempGitRepo, type TempGitRepo} from '../../test/fixtures/gitRepo';
import type {CommitMessage} from '../version/commits.mts';
import {
  checkMainPush,
  parseRefUpdates,
  repositoryAt,
  runPrePush,
  type PushedRepository,
  type RefUpdate,
} from './pre-push.mts';

const NULL_SHA = '0000000000000000000000000000000000000000';
const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);

function update(remoteRef: string, localSha = SHA_A): RefUpdate {
  return {localRef: remoteRef, localSha, remoteRef, remoteSha: SHA_B};
}

const MAIN = update('refs/heads/main');
const BRANCH = update('refs/heads/chore/devops/branch-ci');

function message(subject: string, body = ''): CommitMessage {
  return {hash: subject.slice(0, 7), subject, body};
}

/** A repository whose main is ahead of origin with valid messages. */
function mockRepository(
  parts: Partial<PushedRepository> = {},
): PushedRepository {
  return {
    isAncestor: () => true,
    messages: () => [message('feat(live): add undo')],
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

  it('stops when origin has commits this push lacks', () => {
    const repo = mockRepository({isAncestor: () => false});
    expect(checkMainPush(repo, MAIN)).toMatch(
      /pull the version bot commit first/,
    );
  });
});

describe('runPrePush', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it.each([
    ['another branch', BRANCH],
    ['main', MAIN],
  ])(
    'checks only the messages of %s and runs no verification',
    (_label, pushed) => {
      expect(runPrePush(mockRepository(), [pushed])).toBe(0);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining(
          'verification runs on each branch in GitHub Actions',
        ),
      );
    },
  );

  it('rejects a bad message on another branch', () => {
    const repo = mockRepository({messages: () => [message('Update stuff')]});
    expect(runPrePush(repo, [BRANCH])).toBe(1);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('"Update stuff"'),
    );
  });

  it('stops a main push that would drop commits on origin', () => {
    const repo = mockRepository({isAncestor: () => false});
    expect(runPrePush(repo, [MAIN])).toBe(1);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('pull the version bot commit first'),
    );
  });

  it('checks every branch in a mixed push', () => {
    const repo = mockRepository({
      messages: revisions =>
        revisions.some(revision => revision.endsWith(SHA_B))
          ? [message('Bad branch message')]
          : [message('feat(live): add undo')],
    });
    const branch = {...BRANCH, localSha: SHA_B, remoteSha: SHA_A};
    expect(runPrePush(repo, [MAIN, branch])).toBe(1);
  });

  it('ignores tags and branch deletions without reading the repository', () => {
    const untouched = (): never => {
      throw new Error('The hook read the repository');
    };
    const repo: PushedRepository = {
      isAncestor: untouched,
      messages: untouched,
    };
    const updates = [
      update('refs/tags/v0.3.0'),
      update('refs/heads/main', NULL_SHA),
      update('refs/heads/chore/devops/old', NULL_SHA),
    ];
    expect(runPrePush(repo, updates)).toBe(0);
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

  it('reads ancestry', async () => {
    const {repo, base} = await startedRepo();
    await repo.commit('feat(live): add undo');
    const read = repositoryAt(repo.path);
    const head = repo.run(['rev-parse', 'HEAD']);
    expect(read.isAncestor(base, head)).toBe(true);
    expect(read.isAncestor(head, base)).toBe(false);
  });

  it('reads subjects, bodies, and a second line', async () => {
    const {repo, base} = await startedRepo();
    await repo.commit('feat(live): add undo');
    commitRaw(
      repo,
      'fix(live): keep the last frame',
      'Co-Authored-By: Someone <someone@example.com>',
    );
    commitRaw(repo, 'fix(live): keep the frame\nand the one before it');
    const read = repositoryAt(repo.path);
    const head = repo.run(['rev-parse', 'HEAD']);
    const messages = read.messages([`${base}..${head}`]);
    expect(messages.map(({subject, body}) => [subject, body !== ''])).toEqual([
      ['fix(live): keep the frame', true],
      ['fix(live): keep the last frame', true],
      ['feat(live): add undo', false],
    ]);
  });
});
