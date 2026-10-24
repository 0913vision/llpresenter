import type {CommitTag, SubjectKind} from './subject.mts';

/** A `major.minor.patch` version. */
export interface Version {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
}

/** Which part of the version a push raises. */
export type Bump = 'major' | 'minor' | 'patch';

const MINOR_TAGS: ReadonlySet<CommitTag> = new Set([
  'break',
  'feat',
  'refactor',
]);
const VERSION_TEXT = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/** Parses `x.y.z`, or returns `null`. */
export function parseVersion(text: string): Version | null {
  const match = VERSION_TEXT.exec(text);
  if (match === null) return null;
  const [major, minor, patch] = match.slice(1).map(Number);
  if (major === undefined || minor === undefined || patch === undefined) {
    return null;
  }
  return {major, minor, patch};
}

/** Renders a version as `x.y.z`. */
export function formatVersion({major, minor, patch}: Version): string {
  return `${major}.${minor}.${patch}`;
}

function raisesMinor(kind: SubjectKind): boolean {
  return kind.kind === 'tagged' && MINOR_TAGS.has(kind.subject.tag);
}

/**
 * Picks the bump under the user's rules. The major version goes up only when
 * the user asked for it. Otherwise any `break`, `feat`, or `refactor` commit
 * raises the minor version, and any other commit the patch version. The
 * bot's own bump commits never count. A subject that breaks the format still
 * counts as a change, at patch level.
 *
 * @param kinds - the subjects of the commits in the pushed range
 * @param majorRequested - whether the user approved a major version
 * @returns the bump, or `null` when there is nothing to count
 */
export function pickBump(
  kinds: readonly SubjectKind[],
  majorRequested: boolean,
): Bump | null {
  if (majorRequested) return 'major';
  const counted = kinds.filter(kind => kind.kind !== 'bump');
  if (counted.length === 0) return null;
  return counted.some(raisesMinor) ? 'minor' : 'patch';
}

/** Raises one part of the version and resets the parts below it. */
export function bumpVersion(version: Version, bump: Bump): Version {
  switch (bump) {
    case 'major':
      return {major: version.major + 1, minor: 0, patch: 0};
    case 'minor':
      return {major: version.major, minor: version.minor + 1, patch: 0};
    case 'patch':
      return {...version, patch: version.patch + 1};
  }
}
