import {pathToFileURL} from 'node:url';
import {git, tryGit} from '../git.mts';

/** Where the committed hooks live, relative to the repository root. */
export const HOOKS_PATH = '.githooks';

/**
 * Points this repository's git at the committed hooks, in the repository
 * config only. Outside a git work tree (an unpacked tarball, a bare
 * repository) it does nothing.
 *
 * @returns whether the hooks were set
 */
export function installHooks(cwd: string): boolean {
  // NOTE(0913vision): A bare repository exits with 0 and prints false, so the
  // output must be exactly true.
  if (tryGit(cwd, ['rev-parse', '--is-inside-work-tree']) !== 'true') {
    return false;
  }
  git(cwd, ['config', '--local', 'core.hooksPath', HOOKS_PATH]);
  return true;
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  installHooks(process.cwd());
}
