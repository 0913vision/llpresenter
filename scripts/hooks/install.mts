import {pathToFileURL} from 'node:url';
import {git, gitSucceeds} from '../git.mts';

/** Where the committed hooks live, relative to the repository root. */
export const HOOKS_PATH = '.githooks';

/**
 * Points this repository's git at the committed hooks, in the repository
 * config only. Outside a git checkout (an unpacked tarball) it does nothing.
 *
 * @returns whether the hooks were set
 */
export function installHooks(cwd: string): boolean {
  if (!gitSucceeds(cwd, ['rev-parse', '--is-inside-work-tree'])) return false;
  git(cwd, ['config', '--local', 'core.hooksPath', HOOKS_PATH]);
  return true;
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  installHooks(process.cwd());
}
