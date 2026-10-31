import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {git, gitSucceeds} from '../git.mts';
import {readStamp, type VerifyStamp} from '../verify/stamp.mts';
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
  /** The checked-out commit. */
  head(): string;
  /** Whether the working tree has no changes. */
  isClean(): boolean;
  /** Whether `ancestor` is in the history of `commit`. */
  isAncestor(ancestor: string, commit: string): boolean;
  /** The tree of a commit. */
  treeOf(commit: string): string;
  /** The messages of the commits `git log` lists for these revisions. */
  messages(revisions: readonly string[]): CommitMessage[];
  /** The last passing verify, or `null` when none is recorded. */
  stamp(): VerifyStamp | null;
}

/** The repository in `cwd`, read with git. */
export function repositoryAt(cwd: string): PushedRepository {
  return {
    head: () => git(cwd, ['rev-parse', 'HEAD']),
    isClean: () => git(cwd, ['status', '--porcelain']) === '',
    isAncestor: (ancestor, commit) =>
      gitSucceeds(cwd, ['merge-base', '--is-ancestor', ancestor, commit]),
    treeOf: commit => git(cwd, ['rev-parse', `${commit}^{tree}`]),
    messages: revisions => readCommitMessages(cwd, revisions),
    stamp: () => readStamp(cwd),
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

/**
 * Finds the update that pushes commits to `main`, ignoring tags, other
 * branches, and deletions.
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
 * Checks a push to `main` before verify runs, so verify tests exactly what is
 * pushed.
 *
 * @returns the reason to stop the push, or `null` when it may go on
 */
export function checkMainPush(
  repo: PushedRepository,
  update: RefUpdate,
): string | null {
  if (repo.head() !== update.localSha) {
    return 'check out the main you push; verify runs on the checked-out tree';
  }
  if (!repo.isClean()) {
    return 'commit or stash your changes first; verify runs on the working tree';
  }
  const fastForward =
    NULL_COMMIT.test(update.remoteSha) ||
    repo.isAncestor(update.remoteSha, update.localSha);
  if (!fastForward) {
    return 'main on origin has commits this push lacks; pull the version bot commit first';
  }
  return checkCommitMessages(repo, update);
}

/** Whether the hook runs verify for a push, and why. */
export type VerifyDecision =
  | {readonly kind: 'skip'; readonly stamp: VerifyStamp}
  | {readonly kind: 'run'; readonly reason: string};

/**
 * Skips verify only when the stamp says the pushed commit's tree already
 * passed `npm run verify` on a clean working tree. Anything else runs it.
 */
export function decideVerify(
  repo: PushedRepository,
  update: RefUpdate,
): VerifyDecision {
  const tree = repo.treeOf(update.localSha);
  const stamp = repo.stamp();
  if (stamp === null) {
    return {kind: 'run', reason: 'no passing verify is recorded'};
  }
  if (stamp.tree !== tree) {
    return {
      kind: 'run',
      reason: 'the last passing verify checked another tree',
    };
  }
  if (!stamp.clean) {
    return {
      kind: 'run',
      reason: 'the last passing verify ran with uncommitted changes',
    };
  }
  return {kind: 'skip', stamp};
}

function runVerify(): boolean {
  // NOTE(0913vision): One command string, because Node 24 warns about
  // arguments passed through a shell. The shell finds npm.cmd on Windows.
  return (
    spawnSync('npm run verify', {stdio: 'inherit', shell: true}).status === 0
  );
}

/** Checks every pushed branch's messages and verifies only a main update. */
export function runPrePush(
  repo: PushedRepository,
  updates: readonly RefUpdate[],
  verify: () => boolean = runVerify,
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
  const update = findMainUpdate(branches);
  if (update === null) {
    if (branches.length > 0) {
      console.log(
        'pre-push: commit messages passed; branch verify runs in GitHub Actions',
      );
    }
    return 0;
  }
  const decision = decideVerify(repo, update);
  if (decision.kind === 'skip') {
    console.log(
      `pre-push: verify skipped: this tree passed npm run verify on a clean tree at ${decision.stamp.verifiedAt}`,
    );
    return 0;
  }
  console.log(`pre-push: running npm run verify: ${decision.reason}`);
  if (!verify()) {
    console.error(
      'pre-push: push stopped: npm run verify failed on main; its summary above names the step and the failed tests',
    );
    return FAILURE_EXIT_CODE;
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
