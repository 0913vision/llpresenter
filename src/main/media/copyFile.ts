import {randomUUID} from 'node:crypto';
import {createReadStream, createWriteStream} from 'node:fs';
import {access, mkdir, rename, rm, stat} from 'node:fs/promises';
import {basename, dirname, extname, join} from 'node:path';
import {Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import type {Result} from '@shared/result';

/** How many numbered names a copy tries before it gives up. */
export const MAX_NAME_TRIES = 1000;

const WHOLE = 100;

export interface CopyOptions {
  readonly from: string;
  readonly to: string;
  readonly signal: AbortSignal;
  /** Receives each whole percent once, as the copy reaches it. */
  readonly onPercent: (percent: number) => void;
}

/**
 * Copies a file through a temporary file in the target folder and then
 * renames it into place, so a cancelled or failed copy leaves nothing behind.
 *
 * @returns The size in bytes, or why the copy failed. Never throws.
 */
export async function copyWithProgress({
  from,
  to,
  signal,
  onPercent,
}: CopyOptions): Promise<Result<number, string>> {
  const temporary = join(dirname(to), `.${basename(to)}.${randomUUID()}.tmp`);
  try {
    const {size} = await stat(from);
    await mkdir(dirname(to), {recursive: true});
    let copied = 0;
    let reported = -1;
    const counter = new Transform({
      transform(chunk: Buffer, _encoding, done) {
        copied += chunk.length;
        const percent =
          size === 0 ? WHOLE : Math.floor((copied * WHOLE) / size);
        if (percent > reported) {
          reported = percent;
          onPercent(percent);
        }
        done(null, chunk);
      },
    });
    await pipeline(
      createReadStream(from),
      counter,
      createWriteStream(temporary, {flags: 'wx'}),
      {signal},
    );
    await rename(temporary, to);
    return {ok: true, value: size};
  } catch (error: unknown) {
    await rm(temporary, {force: true});
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function exists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

/**
 * A free path for a file name in a folder: the name itself, else the name with
 * " (2)", " (3)", and so on before its extension.
 *
 * @returns Null when every numbered name up to {@link MAX_NAME_TRIES} exists.
 */
export async function freePath(
  folder: string,
  fileName: string,
): Promise<string | null> {
  const extension = extname(fileName);
  const stem = fileName.slice(0, fileName.length - extension.length);
  for (let number = 1; number <= MAX_NAME_TRIES; number++) {
    const name = number === 1 ? fileName : `${stem} (${number})${extension}`;
    const path = join(folder, name);
    if (!(await exists(path))) return path;
  }
  return null;
}
