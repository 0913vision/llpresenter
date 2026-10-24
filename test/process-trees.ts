import {readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {vi} from 'vitest';

/** The two processes of a hung tree. */
export interface HungTreePids {
  readonly parent: number;
  readonly child: number;
}

const HUNG_TREE_FILE = 'hung-tree.cjs';
const ORPHANING_TREE_FILE = 'orphaning-tree.cjs';
const PIDS_SUFFIX = '.pids';
const WAIT_TIMEOUT_MS = 30_000;
const WAIT_INTERVAL_MS = 50;

function treeSource(childOptions: string, parentEnd: string): string {
  return `
const {spawn} = require('node:child_process');
const {writeFileSync} = require('node:fs');
const {join} = require('node:path');
const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
  stdio: 'inherit',
  windowsHide: true,
  ${childOptions}
});
const name = process.argv.at(-1);
writeFileSync(join(__dirname, name + '${PIDS_SUFFIX}'), process.pid + ' ' + child.pid);
${parentEnd}
`;
}

/**
 * Writes a Node script into `dir` that starts a child that never ends, then
 * never ends either. Like a test runner's workers, the child shares its
 * parent's output pipes. Once both run, the script writes their ids to
 * `<last argument>.pids` in `dir`.
 *
 * @returns the script's path
 */
export async function writeHungTree(dir: string): Promise<string> {
  const path = join(dir, HUNG_TREE_FILE);
  await writeFile(path, treeSource('', 'setInterval(() => {}, 1000);'));
  return path;
}

/**
 * Writes a Node script into `dir` like {@link writeHungTree}, except that the
 * parent ends right after it writes the ids. Its child is detached, so it
 * outlives the parent and keeps the output pipes open, out of taskkill's
 * reach. The test must end the child itself.
 *
 * @returns the script's path
 */
export async function writeOrphaningTree(dir: string): Promise<string> {
  const path = join(dir, ORPHANING_TREE_FILE);
  await writeFile(path, treeSource('detached: true,', 'process.exit(0);'));
  return path;
}

async function readPids(path: string): Promise<HungTreePids> {
  const [parent, child] = (await readFile(path, 'utf8')).split(' ').map(Number);
  if (
    parent === undefined ||
    child === undefined ||
    !Number.isInteger(parent) ||
    !Number.isInteger(child)
  ) {
    throw new Error(`${path} has no process ids yet`);
  }
  return {parent, child};
}

/** Waits until the hung tree started with `name` has both processes running. */
export function waitForHungTree(
  dir: string,
  name: string,
): Promise<HungTreePids> {
  return vi.waitFor(() => readPids(join(dir, name + PIDS_SUFFIX)), {
    timeout: WAIT_TIMEOUT_MS,
    interval: WAIT_INTERVAL_MS,
  });
}

/** Says whether a process with this id is still running. */
export function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ESRCH') {
      return false;
    }
    throw error;
  }
}
