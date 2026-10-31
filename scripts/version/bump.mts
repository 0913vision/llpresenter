import {git, gitSucceeds} from '../git.mts';
import {readCommitMessages, type CommitMessage} from './commits.mts';
import {
  readPackageVersion,
  VERSION_FILES,
  writePackageVersion,
} from './package-version.mts';
import {bumpSubject, classifySubject} from './subject.mts';
import {
  bumpVersion,
  formatVersion,
  parseVersion,
  pickBump,
  type Bump,
  type Version,
} from './version.mts';

const TAG_PREFIX = 'v';
const VERSION_TAG_PATTERN = 'v[0-9]*';

/** What the workflow, or the user with `--dry-run`, asked for. */
export interface BumpRequest {
  readonly major: boolean;
  readonly dryRun: boolean;
}

/** What a bump reads and changes in the repository. */
export interface VersionRepository {
  /** The version tags in the checked-out history, newest first. */
  versionTags(): readonly string[];
  /** The messages of the commits `git log` lists for these revisions. */
  messages(revisions: readonly string[]): readonly CommitMessage[];
  /** The version in `package.json`. */
  readVersion(): Promise<string>;
  tagExists(tag: string): boolean;
  /** Writes the version to both files, commits the bump, and tags it. */
  commitVersion(version: string): Promise<void>;
}

/** The repository in `cwd`, read and changed with git. */
export function versionRepositoryAt(cwd: string): VersionRepository {
  return {
    versionTags: () =>
      git(cwd, [
        'tag',
        '--list',
        VERSION_TAG_PATTERN,
        '--merged',
        'HEAD',
        '--sort=-v:refname',
      ])
        .split('\n')
        .filter(tag => tag !== ''),
    messages: revisions => readCommitMessages(cwd, revisions),
    readVersion: () => readPackageVersion(cwd),
    tagExists: tag =>
      gitSucceeds(cwd, [
        'rev-parse',
        '--verify',
        '--quiet',
        `refs/tags/${tag}`,
      ]),
    commitVersion: async version => {
      await writePackageVersion(cwd, version);
      const tag = `${TAG_PREFIX}${version}`;
      git(cwd, ['add', '--', ...VERSION_FILES]);
      git(cwd, ['commit', '--quiet', '-m', bumpSubject(version)]);
      git(cwd, ['tag', '-a', tag, '-m', tag]);
    },
  };
}

/** Everything a bump needs from outside, so tests can replace it. */
export interface BumpEnvironment {
  readonly repo: VersionRepository;
  /** Whether this may commit and tag; only the bot in GitHub Actions may. */
  readonly mayCommit: boolean;
  readonly print: (line: string) => void;
}

/** What a bump found and did. */
export interface BumpOutcome {
  readonly from: string;
  /** The new version, or `null` when there was nothing to bump. */
  readonly to: string | null;
  readonly bump: Bump | null;
  readonly committed: boolean;
}

interface CommitRange {
  readonly revisions: readonly string[];
  readonly label: string;
}

/** A bump that can't go ahead, with the reason. */
export class BumpError extends Error {
  override readonly name = 'BumpError';
}

function latestVersionTag(repo: VersionRepository): string | null {
  return (
    repo
      .versionTags()
      .find(tag => parseVersion(tag.slice(TAG_PREFIX.length)) !== null) ?? null
  );
}

// NOTE(0913vision): Every commit that no version tag covers yet counts: those
// since the last tag, or the whole history before the first one. A run that
// was cancelled or failed never tags, so the next run still counts its
// commits.
function commitRange(repo: VersionRepository): CommitRange {
  const tag = latestVersionTag(repo);
  if (tag !== null) return {revisions: [`${tag}..HEAD`], label: `since ${tag}`};
  return {revisions: ['HEAD'], label: 'in the whole history'};
}

async function currentVersion(repo: VersionRepository): Promise<Version> {
  const text = await repo.readVersion();
  const version = parseVersion(text);
  if (version === null) {
    throw new BumpError(`package.json has the version "${text}", not x.y.z`);
  }
  return version;
}

function checkTagIsFree(repo: VersionRepository, version: string): void {
  const tag = `${TAG_PREFIX}${version}`;
  if (repo.tagExists(tag)) throw new BumpError(`the tag ${tag} already exists`);
}

/**
 * Raises the version in `package.json` and `package-lock.json` from the
 * commits since the last bump, then commits `Bump version: x.y.z` and tags
 * `vx.y.z`. Never pushes; the workflow does. With `dryRun`, it only prints
 * what it would do.
 *
 * @throws BumpError when the version can't be raised, with the reason
 */
export async function bumpFromCommits(
  request: BumpRequest,
  env: BumpEnvironment,
): Promise<BumpOutcome> {
  if (!request.dryRun && !env.mayCommit) {
    throw new BumpError('only the version bot commits a bump; use --dry-run');
  }
  const range = commitRange(env.repo);
  const messages = env.repo.messages(range.revisions);
  const kinds = messages.map(m => classifySubject(m.subject));
  const current = await currentVersion(env.repo);
  const from = formatVersion(current);
  const bump = pickBump(kinds, request.major);
  if (bump === null) {
    env.print(`version: nothing to bump ${range.label}; only bump commits`);
    return {from, to: null, bump: null, committed: false};
  }
  const to = formatVersion(bumpVersion(current, bump));
  checkTagIsFree(env.repo, to);
  env.print(
    `version: ${from} -> ${to} (${bump}) from ${messages.length} commits ${range.label}`,
  );
  if (request.dryRun) return {from, to, bump, committed: false};
  await env.repo.commitVersion(to);
  env.print(
    `version: committed "${bumpSubject(to)}" and tagged ${TAG_PREFIX}${to}`,
  );
  return {from, to, bump, committed: true};
}
