import {readdir, readFile} from 'node:fs/promises';
import type {Result} from '@shared/result';
import type {FileError, LoadedFile} from '@shared/schema/fileFormat';

/** Reads one file's text the way the schemas do. Never throws. */
export type ParseFile<T> = (
  text: string,
  file: string,
) => Result<LoadedFile<T>, FileError>;

/**
 * A file's text, `null` when the file doesn't exist, or why it couldn't be
 * read. Never throws.
 */
export async function readTextFile(
  file: string,
): Promise<Result<string | null, FileError>> {
  try {
    return {ok: true, value: await readFile(file, 'utf8')};
  } catch (error: unknown) {
    return isMissing(error)
      ? {ok: true, value: null}
      : {ok: false, error: readProblem(file, error)};
  }
}

/**
 * A file read through its schema, `null` when the file doesn't exist, or why
 * it couldn't be read or failed the schema. Never throws.
 */
export async function loadFile<T>(
  file: string,
  parse: ParseFile<T>,
): Promise<Result<LoadedFile<T> | null, FileError>> {
  const text = await readTextFile(file);
  if (!text.ok) {
    return text;
  }
  return text.value === null
    ? {ok: true, value: null}
    : parse(text.value, file);
}

/**
 * The names in a folder in sorted order, none when the folder doesn't exist,
 * or why it couldn't be read. Never throws.
 */
export async function listFolder(
  folder: string,
): Promise<Result<readonly string[], FileError>> {
  try {
    return {ok: true, value: (await readdir(folder)).sort()};
  } catch (error: unknown) {
    return isMissing(error)
      ? {ok: true, value: []}
      : {ok: false, error: readProblem(folder, error)};
  }
}

function readProblem(file: string, error: unknown): FileError {
  const message = error instanceof Error ? error.message : String(error);
  return {kind: 'read', file, field: '', message};
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
