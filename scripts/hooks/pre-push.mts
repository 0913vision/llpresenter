import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {git, gitSucceeds} from '../git.mts';
import {readCommitMessages} from '../version/commits.mts';
import {classifySubject} from '../version/subject.mts';

/** One line that git writes to the pre-push hook's standard input. */
export interface RefUpdate {
  readonly localRef: string;
  readonly localSha: string;
  readonly remoteRef: string;
  readonly remoteSha: string;
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

/**
 * Finds the update that pushes commits to `main`. Tags, other branches, and
 * deleting `main` pass without a check.
 */
export function findMainUpdate(
  updates: readonly RefUpdate[],
): RefUpdate | null {
  return (
    updates.find(
      update =>
        update.remoteRef === MAIN_REF && !NULL_COMMIT.test(update.localSha),
    ) ?? null
  );
}

function pushedRevisions(update: RefUpdate): string[] {
  if (NULL_COMMIT.test(update.remoteSha)) {
    return [update.localSha, '--not', '--remotes'];
  }
  return [`${update.remoteSha}..${update.localSha}`];
}

function badMessages(cwd: string, update: RefUpdate): string[] {
  return readCommitMessages(cwd, pushedRevisions(update)).flatMap(
    ({hash, subject, body}) => {
      if (classifySubject(subject).kind === 'invalid') {
        return [`${hash} "${subject}"`];
      }
      return body === '' ? [] : [`${hash} has a body or trailers`];
    },
  );
}

/**
 * Checks a push to `main` before verify runs, so verify tests exactly what is
 * pushed.
 *
 * @returns the reason to stop the push, or `null` when it may go on
 */
export function checkMainPush(cwd: string, update: RefUpdate): string | null {
  if (git(cwd, ['rev-parse', 'HEAD']) !== update.localSha) {
    return 'check out the main you push; verify runs on the checked-out tree';
  }
  if (git(cwd, ['status', '--porcelain']) !== '') {
    return 'commit or stash your changes first; verify runs on the working tree';
  }
  const fastForward =
    NULL_COMMIT.test(update.remoteSha) ||
    gitSucceeds(cwd, [
      'merge-base',
      '--is-ancestor',
      update.remoteSha,
      update.localSha,
    ]);
  if (!fastForward) {
    return 'main on origin has commits this push lacks; pull the version bot commit first';
  }
  const bad = badMessages(cwd, update);
  if (bad.length > 0) {
    return `fix these commit messages first: ${bad.join(', ')}`;
  }
  return null;
}

function runVerify(): boolean {
  // NOTE(0913vision): One command string, because Node 24 warns about
  // arguments passed through a shell. The shell finds npm.cmd on Windows.
  return (
    spawnSync('npm run verify', {stdio: 'inherit', shell: true}).status === 0
  );
}

function main(): void {
  const update = findMainUpdate(parseRefUpdates(readFileSync(0, 'utf8')));
  if (update === null) return;
  const cwd = process.cwd();
  const problem = checkMainPush(cwd, update);
  if (problem !== null) {
    console.error(`pre-push: push stopped: ${problem}`);
    process.exitCode = FAILURE_EXIT_CODE;
    return;
  }
  if (!runVerify()) {
    console.error(
      'pre-push: push stopped: npm run verify failed on main; its summary above names the step and the failed tests',
    );
    process.exitCode = FAILURE_EXIT_CODE;
  }
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  main();
}
