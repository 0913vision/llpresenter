import {git} from '../git.mts';

/** One commit message as git stores it. */
export interface CommitMessage {
  readonly hash: string;
  /** The first line of the raw message. */
  readonly subject: string;
  /** Everything after the first line, trimmed; empty for a one-line message. */
  readonly body: string;
}

const FIELD = '\x1f';
const RECORD = '\x1e';

// NOTE(0913vision): The raw message (%B), because %s joins the lines of the
// first paragraph into one subject. A second line without a blank line before
// it would then hide inside the subject and leave the body empty.
function splitMessage(hash: string, raw: string): CommitMessage {
  const newline = raw.indexOf('\n');
  if (newline === -1) return {hash, subject: raw.trim(), body: ''};
  return {
    hash,
    subject: raw.slice(0, newline).trim(),
    body: raw.slice(newline + 1).trim(),
  };
}

/**
 * Lists commit messages newest first.
 *
 * @param revisions - what `git log` should list, for example `['v0.2.0..HEAD']`
 */
export function readCommitMessages(
  cwd: string,
  revisions: readonly string[],
): CommitMessage[] {
  const log = git(cwd, ['log', `--format=%h${FIELD}%B${RECORD}`, ...revisions]);
  return log
    .split(RECORD)
    .map(record => record.replace(/^\n/, ''))
    .filter(record => record !== '')
    .map(record => {
      const [hash = '', raw = ''] = record.split(FIELD);
      return splitMessage(hash, raw);
    });
}
