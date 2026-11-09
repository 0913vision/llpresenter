import {extname, join} from 'node:path';
import type {FileError, LoadedFile} from '@core/schema/fileFormat';
import {listFolder, loadFile, type ParseFile} from './readFiles';

const READ_CONCURRENCY = 8;

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
  const files = names.value
    .filter(name => extname(name) === extension)
    .map(name => join(folder, name));
  for (let offset = 0; offset < files.length; offset += READ_CONCURRENCY) {
    const batch = await Promise.all(
      files.slice(offset, offset + READ_CONCURRENCY).map(async file => ({
        file,
        loaded: await loadFile(file, parse),
      })),
    );
    for (const {file, loaded} of batch) {
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
