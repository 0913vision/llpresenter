import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {makeTempGitRepo, type TempGitRepo} from '../../test/git-repo';
import {BumpError, bumpFromCommits, type BumpOutcome} from './bump.mts';

// NOTE(0913vision): Each case runs a dozen git commands, which take up to a
// few seconds together on a loaded Windows machine.
const GIT_TIMEOUT_MS = 60_000;

const MANIFEST = {name: 'llp-test', version: '0.2.0', private: true};
const LOCKFILE = {
  name: 'llp-test',
  version: '0.2.0',
  lockfileVersion: 3,
  requires: true,
  packages: {'': {name: 'llp-test', version: '0.2.0'}},
};

interface BumpCase {
  readonly major?: boolean;
  readonly dryRun?: boolean;
  readonly mayCommit?: boolean;
}

function asJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function packageRepo(): Promise<TempGitRepo> {
  const repo = await makeTempGitRepo();
  await repo.commit('chore(repo): start the project', {
    'package.json': asJson(MANIFEST),
    'package-lock.json': asJson(LOCKFILE),
  });
  return repo;
}

async function runBump(
  repo: TempGitRepo,
  options: BumpCase = {},
): Promise<BumpOutcome> {
  return bumpFromCommits(
    {
      major: options.major ?? false,
      dryRun: options.dryRun ?? false,
    },
    {
      cwd: repo.path,
      mayCommit: options.mayCommit ?? true,
      print: () => undefined,
    },
  );
}

async function readJsonFile(repo: TempGitRepo, file: string): Promise<unknown> {
  const parsed: unknown = JSON.parse(
    await readFile(join(repo.path, file), 'utf8'),
  );
  return parsed;
}

describe('bumpFromCommits', {timeout: GIT_TIMEOUT_MS}, () => {
  it('commits the bump, tags it, and sets both versions', async () => {
    const repo = await packageRepo();
    await repo.commit('feat(live): add undo');
    expect(await runBump(repo)).toEqual({
      from: '0.2.0',
      to: '0.3.0',
      bump: 'minor',
      committed: true,
    });
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

  it('counts only the commits since the last version tag', async () => {
    const repo = await packageRepo();
    await repo.commit('feat(live): add undo');
    await runBump(repo);
    await repo.commit('fix(live): keep the last frame');
    expect((await runBump(repo)).to).toBe('0.3.1');
  });

  it('still counts a feat push whose run was cancelled before the first tag', async () => {
    const repo = await packageRepo();
    await repo.commit('feat(live): add undo');
    await repo.commit('docs(spec): describe undo');
    expect(await runBump(repo)).toMatchObject({bump: 'minor', to: '0.3.0'});
  });

  it('still counts a feat push whose run was cancelled after a tag', async () => {
    const repo = await packageRepo();
    await repo.commit('fix(live): keep the last frame');
    await runBump(repo);
    await repo.commit('feat(live): add undo');
    await repo.commit('docs(spec): describe undo');
    expect(await runBump(repo)).toMatchObject({bump: 'minor', to: '0.3.0'});
  });

  it('does nothing when only bump commits are new', async () => {
    const repo = await packageRepo();
    await repo.commit('fix(live): keep the last frame');
    await runBump(repo);
    const head = repo.run(['rev-parse', 'HEAD']);
    expect(await runBump(repo)).toMatchObject({to: null, committed: false});
    expect(repo.run(['rev-parse', 'HEAD'])).toBe(head);
  });

  it('raises the major only when the user asked for it', async () => {
    const repo = await packageRepo();
    await repo.commit('fix(live): keep the last frame');
    expect((await runBump(repo, {major: true})).to).toBe('1.0.0');
  });

  it('changes nothing in a dry run', async () => {
    const repo = await packageRepo();
    await repo.commit('feat(live): add undo');
    const head = repo.run(['rev-parse', 'HEAD']);
    const outcome = await runBump(repo, {dryRun: true, mayCommit: false});
    expect(outcome).toMatchObject({to: '0.3.0', committed: false});
    expect(repo.run(['rev-parse', 'HEAD'])).toBe(head);
    expect(repo.run(['tag', '--list'])).toBe('');
    expect(await readJsonFile(repo, 'package.json')).toEqual(MANIFEST);
  });

  it('refuses to commit anywhere but in the bot', async () => {
    const repo = await packageRepo();
    await repo.commit('feat(live): add undo');
    await expect(runBump(repo, {mayCommit: false})).rejects.toThrow(BumpError);
  });

  it('refuses when the next tag already exists', async () => {
    const repo = await packageRepo();
    repo.run(['tag', '-a', 'v0.3.0', '-m', 'v0.3.0']);
    await repo.commit('feat(live): add undo');
    await expect(runBump(repo)).rejects.toThrow(/v0.3.0 already exists/);
  });
});
