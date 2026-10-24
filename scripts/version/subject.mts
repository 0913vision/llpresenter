/** The commit tags that `CLAUDE.md` allows, in its order. */
export const COMMIT_TAGS = [
  'break',
  'feat',
  'fix',
  'refactor',
  'style',
  'docs',
  'test',
  'chore',
] as const;

/** One of the commit tags. */
export type CommitTag = (typeof COMMIT_TAGS)[number];

/** A commit subject split into its parts. */
export interface CommitSubject {
  readonly tag: CommitTag;
  readonly scope: string;
  readonly sentence: string;
}

/** What a commit subject is, for the version rules and the push check. */
export type SubjectKind =
  | {readonly kind: 'bump'}
  | {readonly kind: 'tagged'; readonly subject: CommitSubject}
  | {readonly kind: 'invalid'};

const SUBJECT = /^([a-z]+)\(([a-z0-9]+(?:-[a-z0-9]+)*)\): ([a-z].*[^.\s])$/;
const BUMP_SUBJECT =
  /^Bump version: (?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/;

/** The subject of the version bot's commits. */
export function bumpSubject(version: string): string {
  return `Bump version: ${version}`;
}

/**
 * Parses `tag(scope): sentence`. The scope is kebab-case, and the sentence
 * starts with a lowercase letter and doesn't end with a period.
 *
 * @returns the parts, or `null` when the subject doesn't follow the format
 */
export function parseSubject(subject: string): CommitSubject | null {
  const match = SUBJECT.exec(subject);
  if (match === null) return null;
  const [, tagText, scope, sentence] = match;
  const tag = COMMIT_TAGS.find(known => known === tagText);
  if (tag === undefined || scope === undefined || sentence === undefined) {
    return null;
  }
  return {tag, scope, sentence};
}

/**
 * Sorts a subject into the version bot's `Bump version: x.y.z`, a valid
 * `tag(scope): sentence`, or neither. The bump subject is the one exception
 * to the format, and only in exactly that form.
 */
export function classifySubject(subject: string): SubjectKind {
  if (BUMP_SUBJECT.test(subject)) return {kind: 'bump'};
  const parsed = parseSubject(subject);
  return parsed === null
    ? {kind: 'invalid'}
    : {kind: 'tagged', subject: parsed};
}
