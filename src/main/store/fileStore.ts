import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import type {Result} from '@shared/result';
import type {FileError, LoadedFile} from '@shared/schema/fileFormat';
import {parseLabels, type Label} from '@shared/schema/labels';
import {parseService, type Service} from '@shared/schema/service';
import {parseSong, type Song} from '@shared/schema/song';
import {DEFAULT_LABELS} from './defaults';
import {loadFolder} from './library';
import {
  readLocationFields,
  resolveLocations,
  type DataLocations,
  type LocationContext,
  type LocationFieldsRead,
} from './locations';

const APP_CONFIG_FILE = 'app.json';
const LABELS_FILE = 'labels.json';
const SONG_EXTENSION = '.llsong';
const SERVICE_EXTENSION = '.llservice';
const IGNORED_FOLDER_MESSAGE =
  'Ignored: the folder is not absolute, or it is outside LLP_USER_DATA';

export interface StoreContext extends LocationContext {
  /** The app data folder, which holds `app.json`. */
  readonly appDataFolder: string;
}

/** Everything the app read at launch, and what it couldn't read. */
export interface LoadedStore {
  readonly locations: DataLocations;
  /** The song library, by song id. */
  readonly songs: ReadonlyMap<string, Song>;
  /** The 예배 순서, by service id. */
  readonly services: ReadonlyMap<string, Service>;
  readonly labels: readonly Label[];
  /**
   * The service 진행 opens: the last opened one when it loaded, otherwise the
   * one with the latest date, or `null` when there is none.
   */
  readonly openServiceId: string | null;
  /**
   * `app.json` couldn't be read or failed validation. The app warns once and
   * never writes over it.
   */
  readonly appConfigBroken: boolean;
  /** Files that were skipped, or parts of files that were dropped. */
  readonly problems: readonly FileError[];
}

interface LabelsRead {
  readonly labels: readonly Label[];
  readonly problems: readonly FileError[];
}

/** Reads the data the app needs at launch. Never throws. */
export async function loadStore(context: StoreContext): Promise<LoadedStore> {
  const appConfigFile = join(context.appDataFolder, APP_CONFIG_FILE);
  const appConfig = await readAppConfig(appConfigFile);
  const {locations, ignored} = resolveLocations(appConfig.fields, context);
  const songs = await loadFolder(locations.songs, SONG_EXTENSION, parseSong);
  const services = await loadFolder(
    locations.services,
    SERVICE_EXTENSION,
    parseService,
  );
  const labels = await readLabels(join(locations.settings, LABELS_FILE));
  return {
    locations,
    songs: dataOf(songs.items),
    services: dataOf(services.items),
    labels: labels.labels,
    openServiceId: chooseOpenService(
      services.items,
      appConfig.config?.lastServiceId,
    ),
    appConfigBroken: appConfig.problem !== null,
    problems: [
      ...(appConfig.problem === null ? [] : [appConfig.problem]),
      ...ignored.map(field => ignoredProblem(appConfigFile, field)),
      ...songs.problems,
      ...services.problems,
      ...labels.problems,
    ],
  };
}

/**
 * The last opened service when it loaded, otherwise the one with the latest
 * date. Dates are `YYYY-MM-DDTHH:mm`, so they sort as text.
 */
export function chooseOpenService(
  services: ReadonlyMap<string, LoadedFile<Service>>,
  lastServiceId: string | undefined,
): string | null {
  if (lastServiceId !== undefined && services.has(lastServiceId)) {
    return lastServiceId;
  }
  let newest: Service | null = null;
  for (const {data} of services.values()) {
    if (newest === null || data.date > newest.date) {
      newest = data;
    }
  }
  return newest?.id ?? null;
}

async function readAppConfig(file: string): Promise<LocationFieldsRead> {
  const text = await readText(file);
  if (text.ok) {
    return text.value === null
      ? {fields: {}, config: null, problem: null}
      : readLocationFields(text.value, file);
  }
  return {fields: {}, config: null, problem: text.error};
}

async function readLabels(file: string): Promise<LabelsRead> {
  const text = await readText(file);
  if (!text.ok) {
    return {labels: DEFAULT_LABELS, problems: [text.error]};
  }
  if (text.value === null) {
    return {labels: DEFAULT_LABELS, problems: []};
  }
  const parsed = parseLabels(text.value, file);
  if (!parsed.ok) {
    return {labels: DEFAULT_LABELS, problems: [parsed.error]};
  }
  return {
    labels: parsed.value.data.labels,
    problems: parsed.value.dropped.map(({field, message}) => ({
      kind: 'invalid',
      file,
      field,
      message,
    })),
  };
}

/** A file's text, `null` when it doesn't exist, or why it couldn't be read. */
async function readText(
  file: string,
): Promise<Result<string | null, FileError>> {
  try {
    return {ok: true, value: await readFile(file, 'utf8')};
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return {ok: true, value: null};
    }
    const message = error instanceof Error ? error.message : String(error);
    return {ok: false, error: {kind: 'read', file, field: '', message}};
  }
}

function dataOf<T>(
  items: ReadonlyMap<string, LoadedFile<T>>,
): ReadonlyMap<string, T> {
  return new Map([...items].map(([id, loaded]) => [id, loaded.data]));
}

function ignoredProblem(file: string, field: string): FileError {
  return {kind: 'invalid', file, field, message: IGNORED_FOLDER_MESSAGE};
}
