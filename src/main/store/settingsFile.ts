import {join} from 'node:path';
import type {Result} from '@shared/result';
import type {
  DroppedValue,
  FileError,
  LoadedFile,
} from '@shared/schema/fileFormat';
import type {DataLocations} from './locations';
import {listFolder, loadFile, type ParseFile} from './readFiles';

const SETTINGS_FILE_EXTENSION = '.json';
const SETTINGS_COPY_KIND = 'settings';
const COPY_EXTENSION = '.json';
const DEFAULTS_FALLBACK = 'running with the defaults';

/** Where an app-wide settings file and its recovery copies are. */
export interface SettingsLocation {
  readonly file: string;
  /** The file's folder in `.복구 사본`. */
  readonly copies: string;
}

/** An app-wide settings file as the app runs it. */
export interface SettingsRead<T> {
  /** The file's data, a recovery copy's data, or `null` for the defaults. */
  readonly data: T | null;
  /** Why the file is broken and what runs instead, or the parts dropped. */
  readonly problems: readonly FileError[];
}

interface RecoveryCopy<T> {
  readonly file: string;
  readonly loaded: LoadedFile<T>;
}

/**
 * Where the settings file of an area is, such as `labels` for
 * `설정/labels.json`, with its copies in `.복구 사본/settings/labels`.
 */
export function settingsLocation(
  locations: DataLocations,
  area: string,
): SettingsLocation {
  return {
    file: join(locations.settings, `${area}${SETTINGS_FILE_EXTENSION}`),
    copies: join(locations.recovery, SETTINGS_COPY_KIND, area),
  };
}

/**
 * Reads an app-wide settings file. When the file is broken, the area runs from
 * its newest readable recovery copy, or else from the defaults, and the
 * problem says which. The broken file stays untouched. A missing file means
 * the defaults, as on the first launch. Never throws.
 */
export async function readSettingsFile<T>(
  location: SettingsLocation,
  parse: ParseFile<T>,
): Promise<SettingsRead<T>> {
  const loaded = await loadFile(location.file, parse);
  if (!loaded.ok) {
    return runFromCopy(loaded.error, location.copies, parse);
  }
  if (loaded.value === null) {
    return {data: null, problems: []};
  }
  return {
    data: loaded.value.data,
    problems: loaded.value.dropped.map(dropped =>
      droppedProblem(location.file, dropped),
    ),
  };
}

async function runFromCopy<T>(
  problem: FileError,
  copiesFolder: string,
  parse: ParseFile<T>,
): Promise<SettingsRead<T>> {
  const copy = await newestReadableCopy(copiesFolder, parse);
  if (!copy.ok) {
    return {
      data: null,
      problems: [withFallback(problem, DEFAULTS_FALLBACK), copy.error],
    };
  }
  if (copy.value === null) {
    return {data: null, problems: [withFallback(problem, DEFAULTS_FALLBACK)]};
  }
  const {file, loaded} = copy.value;
  const fallback = `running from the recovery copy ${file}`;
  return {
    data: loaded.data,
    problems: [
      withFallback(problem, fallback),
      ...loaded.dropped.map(dropped => droppedProblem(file, dropped)),
    ],
  };
}

// NOTE(0913vision): Copy names are times, so sorting them by name sorts them
// in time order, and the newest copy that passes the schema wins.
async function newestReadableCopy<T>(
  folder: string,
  parse: ParseFile<T>,
): Promise<Result<RecoveryCopy<T> | null, FileError>> {
  const names = await listFolder(folder);
  if (!names.ok) {
    return names;
  }
  const newestFirst = names.value
    .filter(name => name.endsWith(COPY_EXTENSION))
    .reverse();
  for (const name of newestFirst) {
    const file = join(folder, name);
    const loaded = await loadFile(file, parse);
    if (loaded.ok && loaded.value !== null) {
      return {ok: true, value: {file, loaded: loaded.value}};
    }
  }
  return {ok: true, value: null};
}

function withFallback(problem: FileError, fallback: string): FileError {
  return {...problem, message: `${problem.message}; ${fallback}`};
}

function droppedProblem(
  file: string,
  {field, message}: DroppedValue,
): FileError {
  return {kind: 'invalid', file, field, message};
}
