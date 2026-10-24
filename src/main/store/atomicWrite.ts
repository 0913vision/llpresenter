import {randomUUID} from 'node:crypto';
import {mkdir, open, rename, rm} from 'node:fs/promises';
import {basename, dirname, join} from 'node:path';
import type {Result} from '@shared/result';

// NOTE(0913vision): On Windows, antivirus and search indexers hold a file open
// for a moment after it changes, so renaming over it can fail with EPERM,
// EBUSY, or EACCES. A few short retries ride that out.
const RENAME_RETRIES = 5;
const RENAME_RETRY_DELAY_MS = 20;
const TRANSIENT_RENAME_CODES = new Set(['EPERM', 'EBUSY', 'EACCES']);
const TEMPORARY_NAME =
  /^\..+\.[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.tmp$/;

/** Why a file couldn't be written. The old file, if any, is unchanged. */
export interface WriteProblem {
  readonly file: string;
  readonly message: string;
}

/**
 * Whether a file name is one that {@link writeFileAtomically} gives its
 * temporary files: `.<file name>.<random version 4 UUID>.tmp`.
 */
export function isTemporaryFileName(name: string): boolean {
  return TEMPORARY_NAME.test(name);
}

/**
 * Writes text to a file so that a crash or a power loss never leaves it half
 * written: the text goes to a temporary file in the same folder, which is
 * flushed to disk and then renamed over the file. Creates the folder when it
 * is missing. Never throws.
 */
export async function writeFileAtomically(
  file: string,
  text: string,
): Promise<Result<void, WriteProblem>> {
  const temporary = join(dirname(file), temporaryName(file));
  try {
    await mkdir(dirname(file), {recursive: true});
    await writeAndFlush(temporary, text);
    await renameWithRetries(temporary, file);
    return {ok: true, value: undefined};
  } catch (error: unknown) {
    const leftover = await removeTemporary(temporary);
    const message = messageOf(error);
    return {
      ok: false,
      error: {
        file,
        message: leftover === null ? message : `${message}; ${leftover}`,
      },
    };
  }
}

async function writeAndFlush(file: string, text: string): Promise<void> {
  const handle = await open(file, 'wx');
  try {
    await handle.writeFile(text, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function renameWithRetries(from: string, to: string): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await rename(from, to);
      return;
    } catch (error: unknown) {
      if (attempt >= RENAME_RETRIES || !isTransient(error)) {
        throw error;
      }
      await delay(RENAME_RETRY_DELAY_MS * attempt);
    }
  }
}

async function removeTemporary(file: string): Promise<string | null> {
  try {
    await rm(file, {force: true});
    return null;
  } catch (error: unknown) {
    return `the temporary file ${file} remains: ${messageOf(error)}`;
  }
}

function isTransient(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof error.code === 'string' &&
    TRANSIENT_RENAME_CODES.has(error.code)
  );
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function temporaryName(file: string): string {
  return `.${basename(file)}.${randomUUID()}.tmp`;
}
