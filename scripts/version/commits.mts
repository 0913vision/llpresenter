import {git} from '../git.mts';

/** One commit message as git stores it. */
export interface CommitMessage {
  readonly hash: string;
  readonly subject: string;
  readonly body: string;
}

const FIELD = '\x1f';
const RECORD = '\x1e';

/**
 * Lists commit messages newest first.
 *
 * @param revisions - what `git log` should list, for example `['v0.2.0..HEAD']`
 */
export function readCommitMessages(
  cwd: string,
  revisions: readonly string[],
): CommitMessage[] {
  const log = git(cwd, [
    'log',
    `--format=%h${FIELD}%s${FIELD}%b${RECORD}`,
    ...revisions,
  ]);
  return log
    .split(RECORD)
    .map(record => record.replace(/^\n/, ''))
    .filter(record => record !== '')
    .map(record => {
      const [hash = '', subject = '', body = ''] = record.split(FIELD);
      return {hash, subject, body: body.trim()};
    });
}
