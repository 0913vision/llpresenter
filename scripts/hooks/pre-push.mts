import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {gitSucceeds} from '../git.mts';
import {readCommitMessages, type CommitMessage} from '../version/commits.mts';
import {classifySubject} from '../version/subject.mts';

/** One line that git writes to the pre-push hook's standard input. */
export interface RefUpdate {
  readonly localRef: string;
  readonly localSha: string;
  readonly remoteRef: string;
  readonly remoteSha: string;
}

/** What the hook reads from the repository it pushes from. */
export interface PushedRepository {
  /** Whether `ancestor` is in the history of `commit`. */
  isAncestor(ancestor: string, commit: string): boolean;
  /** The messages of the commits `git log` lists for these revisions. */
  messages(revisions: readonly string[]): CommitMessage[];
}

/** The repository in `cwd`, read with git. */
export function repositoryAt(cwd: string): PushedRepository {
  return {
    isAncestor: (ancestor, commit) =>
      gitSucceeds(cwd, ['merge-base', '--is-ancestor', ancestor, commit]),
    messages: revisions => readCommitMessages(cwd, revisions),
  };
}

const MAIN_REF = 'refs/heads/main';
const NULL_COMMIT = /^0+$/;
const FAILURE_EXIT_CODE = 1;

/** Reads the `<local ref> <local sha> <remote ref> <remote sha>` lines. */
export function parseRefUpdates(input: string): RefUpdate[] {
  return input
    .split(/\r?\n/)
    .map(line => line.trim().split(/\s+/))
    .flatMap(([localRef, localSha, remoteRef, remoteSha]) =>
      localRef && localSha && remoteRef && remoteSha
        ? [{localRef, localSha, remoteRef, remoteSha}]
        : [],
    );
}

function pushedRevisions(update: RefUpdate): string[] {
  if (NULL_COMMIT.test(update.remoteSha)) {
    return [update.localSha, '--not', '--remotes'];
  }
  return [`${update.remoteSha}..${update.localSha}`];
}

function badMessages(repo: PushedRepository, update: RefUpdate): string[] {
  return repo
    .messages(pushedRevisions(update))
    .flatMap(({hash, subject, body}) => {
      if (classifySubject(subject).kind === 'invalid') {
        return [`${hash} "${subject}"`];
      }
      return body === '' ? [] : [`${hash} has a body or trailers`];
    });
}

function checkCommitMessages(
  repo: PushedRepository,
  update: RefUpdate,
): string | null {
  const bad = badMessages(repo, update);
  return bad.length > 0
    ? `fix these commit messages first: ${bad.join(', ')}`
    : null;
}

/**
 * Checks a push to `main`: it only moves `main` forward, and every pushed
 * commit message follows the format. Verification already ran on the branch.
 *
 * @returns the reason to stop the push, or `null` when it may go on
 */
export function checkMainPush(
  repo: PushedRepository,
  update: RefUpdate,
): string | null {
  const fastForward =
    NULL_COMMIT.test(update.remoteSha) ||
    repo.isAncestor(update.remoteSha, update.localSha);
  if (!fastForward) {
    return 'main on origin has commits this push lacks; pull the version bot commit first';
  }
  return checkCommitMessages(repo, update);
}

/** Checks the commit messages of every pushed branch, and that main moves forward. */
export function runPrePush(
  repo: PushedRepository,
  updates: readonly RefUpdate[],
): number {
  const branches = updates.filter(
    update =>
      update.remoteRef.startsWith('refs/heads/') &&
      !NULL_COMMIT.test(update.localSha),
  );
  for (const update of branches) {
    const problem =
      update.remoteRef === MAIN_REF
        ? checkMainPush(repo, update)
        : checkCommitMessages(repo, update);
    if (problem !== null) {
      console.error(`pre-push: push stopped: ${problem}`);
      return FAILURE_EXIT_CODE;
    }
  }
  if (branches.length > 0) {
    console.log(
      'pre-push: commit messages passed; verification runs on each branch in GitHub Actions',
    );
  }
  return 0;
}

function main(): void {
  process.exitCode = runPrePush(
    repositoryAt(process.cwd()),
    parseRefUpdates(readFileSync(0, 'utf8')),
  );
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  main();
}
