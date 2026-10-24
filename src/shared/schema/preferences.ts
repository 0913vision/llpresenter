import * as v from 'valibot';
import type {Result} from '../result';
import {
  parseFile,
  serializeFile,
  type FileError,
  type FileFormat,
  type LoadedFile,
  type ReadonlyKnown,
} from './fileFormat';
import type {MigrationStep} from './migration';
import {positiveInteger} from './primitives';

const PREFERENCES_FORMAT = 'llsettings.preferences';

const optionalBoolean = v.exactOptional(v.boolean());
const optionalCount = v.exactOptional(positiveInteger);

const preferencesSchema = v.looseObject({
  format: v.literal(PREFERENCES_FORMAT),
  schemaVersion: positiveInteger,
  language: v.exactOptional(v.picklist(['ko'])),
  onLaunch: v.exactOptional(v.picklist(['lastService'])),
  backupCopies: optionalCount,
  showOnLaunch: optionalBoolean,
  preventSleep: optionalBoolean,
  alwaysOnTop: optionalBoolean,
  onDisconnect: v.exactOptional(v.picklist(['window', 'off'])),
  hardwareAcceleration: optionalBoolean,
  previewFps: optionalCount,
  backup: v.exactOptional(
    v.looseObject({auto: optionalBoolean, keep: optionalCount}),
  ),
  bible: v.exactOptional(
    v.looseObject({
      verseNumbers: optionalBoolean,
      maxLines: optionalCount,
      sourcePosition: v.exactOptional(v.picklist(['bottomRight'])),
    }),
  ),
  import: v.exactOptional(
    v.looseObject({
      txt: v.exactOptional(
        v.looseObject({
          split: v.exactOptional(
            v.picklist(['blankLine', 'lineBreak', 'symbol']),
          ),
          labels: v.exactOptional(v.picklist(['bracketLine', 'off'])),
          firstLine: v.exactOptional(v.picklist(['title', 'lyrics'])),
          encoding: v.exactOptional(v.picklist(['auto', 'utf-8', 'cp949'])),
        }),
      ),
    }),
  ),
});

const preferencesMigrations: readonly MigrationStep[] = [];

const preferencesFormat: FileFormat<typeof preferencesSchema> = {
  format: PREFERENCES_FORMAT,
  schema: preferencesSchema,
  migrations: preferencesMigrations,
};

/**
 * `preferences.json` as stored: 환경설정, where an absent field means its
 * default. Use {@link withPreferenceDefaults} to read values.
 */
export type PreferencesFile = ReadonlyKnown<
  v.InferOutput<typeof preferencesSchema>
>;

type Complete<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? {readonly [Key in keyof T]-?: Complete<T[Key]>}
    : T;

/** 환경설정 with every field present. */
export type Preferences = Complete<PreferencesFile>;

/** Every 환경설정 default of `docs/spec/02-data.md`, as a complete file. */
export const defaultPreferences: Preferences = {
  format: PREFERENCES_FORMAT,
  schemaVersion: 1,
  language: 'ko',
  onLaunch: 'lastService',
  backupCopies: 10,
  showOnLaunch: false,
  preventSleep: true,
  alwaysOnTop: true,
  onDisconnect: 'window',
  hardwareAcceleration: true,
  previewFps: 30,
  backup: {auto: true, keep: 30},
  bible: {verseNumbers: true, maxLines: 4, sourcePosition: 'bottomRight'},
  import: {
    txt: {
      split: 'blankLine',
      labels: 'bracketLine',
      firstLine: 'title',
      encoding: 'auto',
    },
  },
};

/** Fills every absent field of a stored file with its default. */
export function withPreferenceDefaults(stored: PreferencesFile): Preferences {
  return {
    ...defaultPreferences,
    ...stored,
    backup: {...defaultPreferences.backup, ...stored.backup},
    bible: {...defaultPreferences.bible, ...stored.bible},
    import: {
      ...stored.import,
      txt: {...defaultPreferences.import.txt, ...stored.import?.txt},
    },
  };
}

export function parsePreferences(
  text: string,
  file: string,
): Result<LoadedFile<PreferencesFile>, FileError> {
  return parseFile(preferencesFormat, text, file);
}

export function serializePreferences(
  preferences: PreferencesFile,
  file: string,
): Result<string, FileError> {
  return serializeFile(preferencesFormat, preferences, file);
}
