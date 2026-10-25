import {readFileSync} from 'node:fs';
import {mkdir, rename, rm, writeFile} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {git} from '../git.mts';
import {isJsonObject} from '../json.mts';

/**
 * Where verify records the last tree it passed, relative to the worktree
 * root. Git ignores `.llp/`, so the stamp is never committed.
 */
export const STAMP_PATH = join('.llp', 'verify-stamp.json');

const STAMP_VERSION = 1;
const TREE_HASH = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;

/** The tree of the checked-out commit, and whether the working tree is it. */
export interface TreeState {
  readonly tree: string;
  readonly clean: boolean;
}

/** What a passing verify records. */
export interface VerifyStamp extends TreeState {
  readonly verifiedAt: string;
}

/** Reads the checked-out tree and whether the working tree has changes. */
export function readTreeState(root: string): TreeState {
  return {
    tree: git(root, ['rev-parse', 'HEAD^{tree}']),
    clean: git(root, ['status', '--porcelain']) === '',
  };
}

/**
 * Builds the stamp for a passing run. It is clean only when the working tree
 * had no changes before and after the run and the commit didn't change.
 */
export function stampFor(
  before: TreeState,
  after: TreeState,
  now: Date,
): VerifyStamp {
  return {
    tree: before.tree,
    clean: before.clean && after.clean && before.tree === after.tree,
    verifiedAt: now.toISOString(),
  };
}

/** Checks a stamp's text, and returns `null` for anything else. */
export function parseStamp(text: string): VerifyStamp | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isJsonObject(value) || value['v'] !== STAMP_VERSION) return null;
  const {tree, clean, verifiedAt} = value;
  if (typeof tree !== 'string' || !TREE_HASH.test(tree)) return null;
  if (typeof clean !== 'boolean' || typeof verifiedAt !== 'string') {
    return null;
  }
  return {tree, clean, verifiedAt};
}

/** Reads the stamp, or `null` when there is none or it can't be used. */
export function readStamp(root: string): VerifyStamp | null {
  try {
    return parseStamp(readFileSync(join(root, STAMP_PATH), 'utf8'));
  } catch {
    return null;
  }
}

async function writeStamp(root: string, stamp: VerifyStamp): Promise<void> {
  const path = join(root, STAMP_PATH);
  const temporary = `${path}.tmp`;
  await mkdir(dirname(path), {recursive: true});
  const text = `${JSON.stringify({v: STAMP_VERSION, ...stamp}, null, 2)}\n`;
  await writeFile(temporary, text, {encoding: 'utf8', flush: true});
  await rename(temporary, path);
}

/**
 * Clears the stamp before verify runs, so a failed or stopped run leaves
 * none, and returns the function that writes it once verify has passed.
 */
export async function beginStamp(
  root: string,
  now: () => Date = () => new Date(),
): Promise<(exitCode: number) => Promise<void>> {
  const before = readTreeState(root);
  await rm(join(root, STAMP_PATH), {force: true});
  return async exitCode => {
    if (exitCode !== 0) return;
    await writeStamp(root, stampFor(before, readTreeState(root), now()));
  };
}
