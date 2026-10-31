import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it, vi} from 'vitest';
import {makeTempGitRepo, type TempGitRepo} from '../../test/git-repo';
import {
  BumpError,
  bumpFromCommits,
  versionRepositoryAt,
  type BumpRequest,
  type VersionRepository,
} from './bump.mts';

interface RepositoryState {
  /** Version tags, newest first. */
  readonly tags?: readonly string[];
  /** The subjects `git log` lists for the range the bump asks for. */
  readonly subjects?: readonly string[];
  readonly version?: string;
}

function mockRepository(state: RepositoryState = {}) {
  const commitVersion = vi.fn(async () => undefined);
  const messages = vi.fn<VersionRepository['messages']>(() =>
    (state.subjects ?? []).map(subject => ({
      hash: 'abc1234',
      subject,
      body: '',
    })),
  );
  const repo: VersionRepository = {
    versionTags: () => state.tags ?? [],
    messages,
    readVersion: async () => state.version ?? '0.2.0',
    tagExists: tag => (state.tags ?? []).includes(tag),
    commitVersion,
  };
  return {repo, commitVersion, messages};
}

function bump(
  repo: VersionRepository,
  request: Partial<BumpRequest> = {},
  mayCommit = true,
) {
  return bumpFromCommits(
    {major: false, dryRun: false, ...request},
    {repo, mayCommit, print: () => undefined},
  );
}

describe('bumpFromCommits', () => {
  it('raises the minor for a feat and commits the new version', async () => {
    const {repo, commitVersion} = mockRepository({
      subjects: ['feat(live): add undo', 'docs(spec): describe undo'],
    });
    expect(await bump(repo)).toEqual({
      from: '0.2.0',
      to: '0.3.0',
      bump: 'minor',
      committed: true,
    });
    expect(commitVersion).toHaveBeenCalledWith('0.3.0');
  });

  it('counts only the commits since the last version tag', async () => {
    const {repo, messages} = mockRepository({
      tags: ['v0.3.0', 'v0.2.0'],
      subjects: ['fix(live): keep the last frame'],
      version: '0.3.0',
    });
    expect((await bump(repo)).to).toBe('0.3.1');
    expect(messages).toHaveBeenCalledWith(['v0.3.0..HEAD']);
  });

  it('counts the whole history before the first tag', async () => {
    const {repo, messages} = mockRepository({
      subjects: ['feat(live): add undo'],
    });
    await bump(repo);
    expect(messages).toHaveBeenCalledWith(['HEAD']);
  });

  it('skips tags that are not versions', async () => {
    const {repo, messages} = mockRepository({
      tags: ['vnext', 'v0.3.0'],
      subjects: ['fix(live): keep the last frame'],
      version: '0.3.0',
    });
    await bump(repo);
    expect(messages).toHaveBeenCalledWith(['v0.3.0..HEAD']);
  });

  it('does nothing when only bump commits are new', async () => {
    const {repo, commitVersion} = mockRepository({
      tags: ['v0.3.0'],
      subjects: ['Bump version: 0.3.0'],
      version: '0.3.0',
    });
    expect(await bump(repo)).toMatchObject({to: null, committed: false});
    expect(commitVersion).not.toHaveBeenCalled();
  });

  it('raises the major only when the user asked for it', async () => {
    const {repo} = mockRepository({
      subjects: ['fix(live): keep the last frame'],
    });
    expect((await bump(repo, {major: true})).to).toBe('1.0.0');
  });

  it('changes nothing in a dry run', async () => {
    const {repo, commitVersion} = mockRepository({
      subjects: ['feat(live): add undo'],
    });
    const outcome = await bump(repo, {dryRun: true}, false);
    expect(outcome).toMatchObject({to: '0.3.0', committed: false});
    expect(commitVersion).not.toHaveBeenCalled();
  });

  it('refuses to commit anywhere but in the bot', async () => {
    const {repo} = mockRepository({subjects: ['feat(live): add undo']});
    await expect(bump(repo, {}, false)).rejects.toThrow(BumpError);
  });

  it('refuses a version that is not x.y.z', async () => {
    const {repo} = mockRepository({
      subjects: ['feat(live): add undo'],
      version: '0.3',
    });
    await expect(bump(repo)).rejects.toThrow(/not x.y.z/);
  });

  it('refuses when the next tag already exists', async () => {
    const {repo} = mockRepository({
      tags: ['v0.3.0'],
      subjects: ['feat(live): add undo'],
      version: '0.2.0',
    });
    await expect(bump(repo)).rejects.toThrow(/v0.3.0 already exists/);
  });
});

const MANIFEST = {name: 'llp-test', version: '0.2.0', private: true};
const LOCKFILE = {
  name: 'llp-test',
  version: '0.2.0',
  lockfileVersion: 3,
  requires: true,
  packages: {'': {name: 'llp-test', version: '0.2.0'}},
};

function asJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function readJsonFile(repo: TempGitRepo, file: string): Promise<unknown> {
  const parsed: unknown = JSON.parse(
    await readFile(join(repo.path, file), 'utf8'),
  );
  return parsed;
}

// NOTE(0913vision): The only tests here that run git. They prove that the real
// repository reads tags and messages and writes, commits, and tags a bump.
describe('versionRepositoryAt', () => {
  async function packageRepo(): Promise<TempGitRepo> {
    const repo = await makeTempGitRepo();
    await repo.commit('chore(repo): start the project', {
      'package.json': asJson(MANIFEST),
      'package-lock.json': asJson(LOCKFILE),
    });
    return repo;
  }

  it('writes both versions, commits the bump, and tags it', async () => {
    const repo = await packageRepo();
    const read = versionRepositoryAt(repo.path);
    expect(await read.readVersion()).toBe('0.2.0');
    await read.commitVersion('0.3.0');
    expect(repo.run(['log', '-1', '--format=%s%n%b'])).toBe(
      'Bump version: 0.3.0',
    );
    expect(repo.run(['cat-file', '-t', 'v0.3.0'])).toBe('tag');
    expect(repo.run(['status', '--porcelain'])).toBe('');
    expect(await readJsonFile(repo, 'package.json')).toEqual({
      ...MANIFEST,
      version: '0.3.0',
    });
    expect(await readJsonFile(repo, 'package-lock.json')).toMatchObject({
      version: '0.3.0',
      packages: {'': {version: '0.3.0'}},
    });
  });

  it('lists version tags newest first and the messages after one', async () => {
    const repo = await packageRepo();
    const read = versionRepositoryAt(repo.path);
    expect(read.versionTags()).toEqual([]);
    repo.run(['tag', '-a', 'v0.2.0', '-m', 'v0.2.0']);
    await repo.commit('feat(live): add undo');
    repo.run(['tag', '-a', 'v0.10.0', '-m', 'v0.10.0']);
    await repo.commit('fix(live): keep the last frame');
    expect(read.versionTags()).toEqual(['v0.10.0', 'v0.2.0']);
    expect(read.tagExists('v0.2.0')).toBe(true);
    expect(read.tagExists('v0.3.0')).toBe(false);
    expect(
      read.messages(['v0.10.0..HEAD']).map(({subject}) => subject),
    ).toEqual(['fix(live): keep the last frame']);
  });
});
