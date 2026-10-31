import {open} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {git} from './git.mts';

const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const CHECKED_EXTENSION = /\.(?:md|markdown|json)$/i;
const FAILURE_EXIT_CODE = 1;

async function hasBom(path: string): Promise<boolean> {
  const file = await open(path, 'r');
  try {
    const prefix = Buffer.alloc(UTF8_BOM.length);
    const {bytesRead} = await file.read(prefix, 0, prefix.length, 0);
    return bytesRead === UTF8_BOM.length && prefix.equals(UTF8_BOM);
  } finally {
    await file.close();
  }
}

/** The tracked Markdown and JSON files, including formatter ignores. */
export function trackedTextFiles(root: string): readonly string[] {
  return git(root, ['ls-files', '-z'])
    .split('\0')
    .filter(file => CHECKED_EXTENSION.test(file));
}

/** Finds the files, relative to `root`, that start with a UTF-8 BOM. */
export async function findBomFiles(
  root: string,
  files: readonly string[],
): Promise<readonly string[]> {
  const found: string[] = [];
  for (const file of files) {
    if (await hasBom(join(root, file))) found.push(file);
  }
  return found;
}

async function main(): Promise<void> {
  const root = process.cwd();
  const files = await findBomFiles(root, trackedTextFiles(root));
  if (files.length > 0) {
    for (const file of files) console.error(`UTF-8 BOM: ${file}`);
    process.exitCode = FAILURE_EXIT_CODE;
    return;
  }
  console.log('No UTF-8 BOMs in tracked Markdown and JSON files.');
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  main().catch((error: unknown) => {
    console.error('BOM check failed:', error);
    process.exitCode = FAILURE_EXIT_CODE;
  });
}
