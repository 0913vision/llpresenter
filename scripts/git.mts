import {spawnSync} from 'node:child_process';

// NOTE(0913vision): Git hooks set these. Left in place, git in a temporary
// test repository would act on the repository that ran the hook.
const REPOSITORY_OVERRIDES = ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE'];

function gitEnvironment(): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      ([name]) => !REPOSITORY_OVERRIDES.includes(name.toUpperCase()),
    ),
  );
}

function runGit(cwd: string, args: readonly string[]) {
  return spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: gitEnvironment(),
  });
}

/**
 * Runs git in `cwd` and returns its output without the trailing newline.
 *
 * @throws Error when git can't start or exits with an error
 */
export function git(cwd: string, args: readonly string[]): string {
  const result = runGit(cwd, args);
  if (result.error !== undefined) {
    throw new Error(`git could not start: ${result.error.message}`, {
      cause: result.error,
    });
  }
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr.trim()}`);
  }
  return result.stdout.trimEnd();
}

/** Runs git in `cwd` and says whether it exited with 0. */
export function gitSucceeds(cwd: string, args: readonly string[]): boolean {
  return runGit(cwd, args).status === 0;
}
