import {lstat, readdir, rm} from 'node:fs/promises';
import {join} from 'node:path';
import type {Result} from '@shared/result';
import {isTemporaryFileName, type WriteProblem} from './atomicWrite';
import {isMissingFile} from './fsErrors';

const STALE_AFTER_MS = 60_000;

/**
 * Removes the temporary files that atomic writes left in a folder when the
 * app stopped in the middle of one. Only plain files with the store's own
 * temporary names, untouched for a minute, are removed, so a write that runs
 * now and everything else in the folder stay. Never throws.
 *
 * @returns The files that couldn't be checked or removed.
 */
export async function removeStaleTempFiles(
  folder: string,
  now: number = Date.now(),
): Promise<readonly WriteProblem[]> {
  const names = await temporaryFileNames(folder);
  if (!names.ok) {
    return [names.error];
  }
  const problems: WriteProblem[] = [];
  for (const name of names.value) {
    const file = join(folder, name);
    try {
      await removeIfStale(file, now);
    } catch (error: unknown) {
      if (!isMissingFile(error)) {
        problems.push({file, message: messageOf(error)});
      }
    }
  }
  return problems;
}

async function temporaryFileNames(
  folder: string,
): Promise<Result<readonly string[], WriteProblem>> {
  try {
    const entries = await readdir(folder, {withFileTypes: true});
    const names = entries
      .filter(entry => entry.isFile() && isTemporaryFileName(entry.name))
      .map(entry => entry.name);
    return {ok: true, value: names};
  } catch (error: unknown) {
    return isMissingFile(error)
      ? {ok: true, value: []}
      : {ok: false, error: {file: folder, message: messageOf(error)}};
  }
}

async function removeIfStale(file: string, now: number): Promise<void> {
  const {mtimeMs} = await lstat(file);
  if (now - mtimeMs >= STALE_AFTER_MS) {
    await rm(file);
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
