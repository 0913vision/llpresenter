import {lstat, realpath} from 'node:fs/promises';
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from 'node:path';
import {isRecord} from '@shared/guards';
import type {Result} from '@shared/result';
import {parseAppConfig, type AppConfig} from '@shared/schema/appConfig';
import type {FileError} from '@shared/schema/fileFormat';

/** The name of the data folder in Documents, and in the development folder. */
export const DATA_FOLDER_NAME = 'LoveLight';

const FOLDER_NAMES = {
  songs: '곡',
  media: '미디어',
  services: '예배',
  templates: '틀',
  settings: '설정',
  recovery: '.복구 사본',
  backups: '백업',
} as const;

const BYTE_ORDER_MARK = /^\uFEFF/;
const LEAVES_DEVELOPMENT_FOLDER =
  'Refused: a junction or link leads this folder outside LLP_USER_DATA';

/** The `app.json` fields that move the data folders. */
export const locationFields = [
  'dataRoot',
  'songsPath',
  'mediaPath',
  'backupPath',
] as const;

export type LocationField = (typeof locationFields)[number];

/** Absolute folders, or an empty string for the default folder. */
export type LocationFields = Readonly<Partial<Record<LocationField, string>>>;

/** Every folder the app reads and writes user data in. */
export interface DataLocations {
  readonly dataRoot: string;
  readonly songs: string;
  readonly media: string;
  readonly services: string;
  readonly templates: string;
  readonly settings: string;
  readonly recovery: string;
  readonly backups: string;
}

const dataLocationNames = [
  'dataRoot',
  'songs',
  'media',
  'services',
  'templates',
  'settings',
  'recovery',
  'backups',
] as const satisfies ReadonlyArray<keyof DataLocations>;

export interface LocationContext {
  /** The user's Documents folder. */
  readonly documents: string;
  /**
   * The `LLP_USER_DATA` folder in development, or `null`. When it is set, the
   * data folder defaults inside it, and no location may leave it, so a
   * development run never touches the user's real data.
   */
  readonly developmentFolder: string | null;
}

export interface ResolvedLocations {
  readonly locations: DataLocations;
  /** Fields that were set but not used: not absolute, or outside the development folder. */
  readonly ignored: readonly LocationField[];
}

/** What `app.json` says about the data folders, even when the file is broken. */
export interface LocationFieldsRead {
  readonly fields: LocationFields;
  /** The whole file when it passed validation, or `null`. */
  readonly config: AppConfig | null;
  /**
   * Why the file failed validation, or `null`. When it is set, the store warns
   * once and never writes over the broken file.
   */
  readonly problem: FileError | null;
}

/** Works out the data folders from the `app.json` fields. */
export function resolveLocations(
  fields: LocationFields,
  context: LocationContext,
): ResolvedLocations {
  const ignored: LocationField[] = [];
  const pick = (field: LocationField, fallback: string): string => {
    const value = fields[field];
    if (value === undefined || value === '') {
      return fallback;
    }
    if (!isAllowed(value, context.developmentFolder)) {
      ignored.push(field);
      return fallback;
    }
    return resolve(value);
  };
  const dataRoot = pick('dataRoot', defaultDataRoot(context));
  return {
    locations: {
      dataRoot,
      songs: pick('songsPath', join(dataRoot, FOLDER_NAMES.songs)),
      media: pick('mediaPath', join(dataRoot, FOLDER_NAMES.media)),
      services: join(dataRoot, FOLDER_NAMES.services),
      templates: join(dataRoot, FOLDER_NAMES.templates),
      settings: join(dataRoot, FOLDER_NAMES.settings),
      recovery: join(dataRoot, FOLDER_NAMES.recovery),
      backups: pick('backupPath', join(dataRoot, FOLDER_NAMES.backups)),
    },
    ignored,
  };
}

/**
 * Checks that every data folder stays inside the development folder once
 * junctions and symbolic links are followed, so a link inside `LLP_USER_DATA`
 * can never lead a development run to real data. A folder that doesn't exist
 * yet is checked through its nearest existing parent, and a link whose target
 * is missing is refused. Call it before any data file is read or written.
 * Without a development folder, every location passes. Never throws.
 *
 * @returns The locations, or the first folder that leads outside, or why a
 *   folder couldn't be checked.
 */
export async function confineLocations(
  locations: DataLocations,
  developmentFolder: string | null,
): Promise<Result<DataLocations, FileError>> {
  if (developmentFolder === null) {
    return {ok: true, value: locations};
  }
  try {
    const root = await canonicalPath(developmentFolder);
    for (const name of dataLocationNames) {
      const folder = locations[name];
      if (!isInside(await canonicalPath(folder), root)) {
        return {ok: false, error: leavesProblem(folder, name)};
      }
    }
    return {ok: true, value: locations};
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: {kind: 'invalid', file: developmentFolder, field: '', message},
    };
  }
}

/**
 * Reads the location fields of `app.json`. When the file fails validation, it
 * still keeps each location field that is text, so a broken window layout
 * never sends the app to the wrong data folder.
 */
export function readLocationFields(
  text: string,
  file: string,
): LocationFieldsRead {
  const parsed = parseAppConfig(text, file);
  if (parsed.ok) {
    const config = parsed.value.data;
    return {fields: pickLocationFields(config), config, problem: null};
  }
  return {
    fields: pickLocationFields(parseLoosely(text)),
    config: null,
    problem: parsed.error,
  };
}

function defaultDataRoot({documents, developmentFolder}: LocationContext) {
  return join(developmentFolder ?? documents, DATA_FOLDER_NAME);
}

function isAllowed(folder: string, developmentFolder: string | null): boolean {
  if (!isAbsolute(folder)) {
    return false;
  }
  return developmentFolder === null || isInside(folder, developmentFolder);
}

function isInside(folder: string, parent: string): boolean {
  const path = relative(parent, folder);
  return path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}

// NOTE(0913vision): A folder that doesn't exist yet takes the real path of its
// nearest existing parent, so a link above it still counts.
async function canonicalPath(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch (error: unknown) {
    const parent = dirname(path);
    if (!isMissing(error) || parent === path || (await isDanglingLink(path))) {
      throw error;
    }
    return join(await canonicalPath(parent), basename(path));
  }
}

async function isDanglingLink(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error: unknown) {
    if (isMissing(error)) {
      return false;
    }
    throw error;
  }
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

function leavesProblem(folder: string, name: keyof DataLocations): FileError {
  return {
    kind: 'invalid',
    file: folder,
    field: name,
    message: LEAVES_DEVELOPMENT_FOLDER,
  };
}

function pickLocationFields(json: unknown): LocationFields {
  if (!isRecord(json)) {
    return {};
  }
  const fields: Partial<Record<LocationField, string>> = {};
  for (const field of locationFields) {
    const value = json[field];
    if (typeof value === 'string') {
      fields[field] = value;
    }
  }
  return fields;
}

// NOTE(0913vision): The parse failure itself is already in `problem`, so text
// that isn't JSON simply has no location fields.
function parseLoosely(text: string): unknown {
  try {
    return JSON.parse(text.replace(BYTE_ORDER_MARK, ''));
  } catch {
    return undefined;
  }
}
