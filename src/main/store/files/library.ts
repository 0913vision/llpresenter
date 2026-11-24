import {extname, join} from 'node:path';
import type {Result} from '@core/common/result';
import type {FileError, LoadedFile} from '@core/schema/fileFormat';
import type {PartCounter} from '../../base/launchTracker';
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

/** The files of a folder with the extension, or why it can't be listed. */
export async function listFiles(
  folder: string,
  extension: string,
): Promise<Result<readonly string[], FileError>> {
  const names = await listFolder(folder);
  if (!names.ok) return names;
  return {
    ok: true,
    value: names.value
      .filter(name => extname(name) === extension)
      .map(name => join(folder, name)),
  };
}

/**
 * Loads files through their schema. A file that fails is skipped and
 * reported, and so is a second file with an id that another file already
 * has; the rest load. A file deleted meanwhile is left out. Never throws.
 */
export async function loadFiles<T extends {readonly id: string}>(
  files: Result<readonly string[], FileError>,
  {
    parse,
    counter,
  }: {
    readonly parse: ParseFile<T>;
    /** Counts the files that are read. */
    readonly counter?: PartCounter | undefined;
  },
): Promise<LoadedFolder<T>> {
  if (!files.ok) return {items: new Map(), problems: [files.error]};
  const items = new Map<string, StoredFile<T>>();
  const problems: FileError[] = [];
  const list = files.value;
  for (let offset = 0; offset < list.length; offset += READ_CONCURRENCY) {
    const batch = await Promise.all(
      list.slice(offset, offset + READ_CONCURRENCY).map(async file => ({
        file,
        loaded: await loadFile(file, parse),
      })),
    );
    counter?.add(batch.length);
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

/**
 * Loads every file with the extension in a folder through its schema. A
 * missing folder holds nothing, as on the first launch. Never throws.
 */
export async function loadFolder<T extends {readonly id: string}>(
  folder: string,
  extension: string,
  options: {readonly parse: ParseFile<T>},
): Promise<LoadedFolder<T>> {
  return loadFiles(await listFiles(folder, extension), options);
}

function duplicateProblem(file: string): FileError {
  return {
    kind: 'invalid',
    file,
    field: 'id',
    message: 'Another file in the folder already has this id',
  };
}
