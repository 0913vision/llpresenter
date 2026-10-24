import {git, gitSucceeds} from '../git.mts';
import {readCommitMessages} from './commits.mts';
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

/** Everything a bump needs from outside, so tests can replace it. */
export interface BumpEnvironment {
  readonly cwd: string;
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

function latestVersionTag(cwd: string): string | null {
  const tags = git(cwd, [
    'tag',
    '--list',
    VERSION_TAG_PATTERN,
    '--merged',
    'HEAD',
    '--sort=-v:refname',
  ]);
  return (
    tags
      .split('\n')
      .find(tag => parseVersion(tag.slice(TAG_PREFIX.length)) !== null) ?? null
  );
}

// NOTE(0913vision): Every commit that no version tag covers yet counts: those
// since the last tag, or the whole history before the first one. A run that
// was cancelled or failed never tags, so the next run still counts its
// commits.
function commitRange(cwd: string): CommitRange {
  const tag = latestVersionTag(cwd);
  if (tag !== null) return {revisions: [`${tag}..HEAD`], label: `since ${tag}`};
  return {revisions: ['HEAD'], label: 'in the whole history'};
}

async function currentVersion(cwd: string): Promise<Version> {
  const text = await readPackageVersion(cwd);
  const version = parseVersion(text);
  if (version === null) {
    throw new BumpError(`package.json has the version "${text}", not x.y.z`);
  }
  return version;
}

function checkTagIsFree(cwd: string, version: string): void {
  const tag = `${TAG_PREFIX}${version}`;
  if (
    gitSucceeds(cwd, ['rev-parse', '--verify', '--quiet', `refs/tags/${tag}`])
  ) {
    throw new BumpError(`the tag ${tag} already exists`);
  }
}

function commitAndTag(cwd: string, version: string): void {
  const tag = `${TAG_PREFIX}${version}`;
  git(cwd, ['add', '--', ...VERSION_FILES]);
  git(cwd, ['commit', '--quiet', '-m', bumpSubject(version)]);
  git(cwd, ['tag', '-a', tag, '-m', tag]);
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
  const range = commitRange(env.cwd);
  const messages = readCommitMessages(env.cwd, range.revisions);
  const kinds = messages.map(m => classifySubject(m.subject));
  const current = await currentVersion(env.cwd);
  const from = formatVersion(current);
  const bump = pickBump(kinds, request.major);
  if (bump === null) {
    env.print(`version: nothing to bump ${range.label}; only bump commits`);
    return {from, to: null, bump: null, committed: false};
  }
  const to = formatVersion(bumpVersion(current, bump));
  checkTagIsFree(env.cwd, to);
  env.print(
    `version: ${from} -> ${to} (${bump}) from ${messages.length} commits ${range.label}`,
  );
  if (request.dryRun) return {from, to, bump, committed: false};
  await writePackageVersion(env.cwd, to);
  commitAndTag(env.cwd, to);
  env.print(
    `version: committed "${bumpSubject(to)}" and tagged ${TAG_PREFIX}${to}`,
  );
  return {from, to, bump, committed: true};
}
