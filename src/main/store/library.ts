import {readdir, readFile} from 'node:fs/promises';
import {extname, join} from 'node:path';
import type {Result} from '@shared/result';
import type {FileError, LoadedFile} from '@shared/schema/fileFormat';

/** Reads one file's text the way the schemas do. Never throws. */
export type ParseFile<T> = (
  text: string,
  file: string,
) => Result<LoadedFile<T>, FileError>;

/** The files of one folder that loaded, by id, and the ones that didn't. */
export interface LoadedFolder<T> {
  readonly items: ReadonlyMap<string, LoadedFile<T>>;
  readonly problems: readonly FileError[];
}

/**
 * Loads every file with the extension in a folder through its schema. A file
 * that fails is skipped and reported, and so is a second file with an id that
 * another file already has; the rest load. A missing folder holds nothing,
 * as on the first launch. Never throws.
 */
export async function loadFolder<T extends {readonly id: string}>(
  folder: string,
  extension: string,
  parse: ParseFile<T>,
): Promise<LoadedFolder<T>> {
  const names = await listFolder(folder);
  if (!names.ok) {
    return {items: new Map(), problems: [names.error]};
  }
  const items = new Map<string, LoadedFile<T>>();
  const problems: FileError[] = [];
  for (const name of names.value.filter(name => extname(name) === extension)) {
    const file = join(folder, name);
    const loaded = await loadFile(file, parse);
    if (!loaded.ok) {
      problems.push(loaded.error);
      continue;
    }
    const {id} = loaded.value.data;
    if (items.has(id)) {
      problems.push(duplicateProblem(file));
      continue;
    }
    items.set(id, loaded.value);
  }
  return {items, problems};
}

async function listFolder(
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

async function loadFile<T>(
  file: string,
  parse: ParseFile<T>,
): Promise<Result<LoadedFile<T>, FileError>> {
  try {
    return parse(await readFile(file, 'utf8'), file);
  } catch (error: unknown) {
    return {ok: false, error: readProblem(file, error)};
  }
}

function duplicateProblem(file: string): FileError {
  return {
    kind: 'invalid',
    file,
    field: 'id',
    message: 'Another file in the folder already has this id',
  };
}

function readProblem(file: string, error: unknown): FileError {
  const message = error instanceof Error ? error.message : String(error);
  return {kind: 'read', file, field: '', message};
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
