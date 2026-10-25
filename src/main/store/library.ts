import {extname, join} from 'node:path';
import type {FileError, LoadedFile} from '@shared/schema/fileFormat';
import {listFolder, loadFile, type ParseFile} from './readFiles';

/** A loaded file, and where it is, so that a change saves to the same file. */
export interface StoredFile<T> extends LoadedFile<T> {
  readonly file: string;
}

/** The files of one folder that loaded, by id, and the ones that didn't. */
export interface LoadedFolder<T> {
  readonly items: ReadonlyMap<string, StoredFile<T>>;
  readonly problems: readonly FileError[];
}

/**
 * Loads every file with the extension in a folder through its schema. A file
 * that fails is skipped and reported, and so is a second file with an id that
 * another file already has; the rest load. A missing folder holds nothing,
 * as on the first launch, and a file deleted while the folder loads is left
 * out. Never throws.
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
  const items = new Map<string, StoredFile<T>>();
  const problems: FileError[] = [];
  for (const name of names.value.filter(name => extname(name) === extension)) {
    const file = join(folder, name);
    const loaded = await loadFile(file, parse);
    if (!loaded.ok) {
      problems.push(loaded.error);
      continue;
    }
    if (loaded.value === null) {
      continue;
    }
    const {id} = loaded.value.data;
    if (items.has(id)) {
      problems.push(duplicateProblem(file));
      continue;
    }
    items.set(id, {...loaded.value, file});
  }
  return {items, problems};
}

function duplicateProblem(file: string): FileError {
  return {
    kind: 'invalid',
    file,
    field: 'id',
    message: 'Another file in the folder already has this id',
  };
}
