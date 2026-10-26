import * as v from 'valibot';
import {isRecord} from '../guards';
import type {Result} from '../result';
import {
  checkPart,
  parseFile,
  serializeFile,
  type DroppedValue,
  type FileError,
  type FileFormat,
  type LoadedFile,
  type PrunedContent,
  type ReadonlyKnown,
} from './fileFormat';
import type {MigrationStep} from './migration';
import {jsonObject, positiveInteger} from './primitives';
import type {PayloadError} from './payload';
import {clearFadeSchema, clearKeyTargets} from './clearFade';

const PREFERENCES_FORMAT = 'llsettings.preferences';

/** The counts 환경설정 allows (`docs/spec/10-shortcuts-and-settings.md`). */
export const PREFERENCE_LIMITS = {
  backupCopies: {min: 3, max: 50},
  backupKeep: {min: 1, max: 365},
  bibleMaxLines: {min: 1, max: 12},
} as const;

/** The frame rates the previews may run at. */
export const previewFpsChoices = [15, 30, 60] as const;

interface CountLimits {
  readonly min: number;
  readonly max: number;
}

const optionalBoolean = v.exactOptional(v.boolean());
const backupCopiesSchema = countWithin(PREFERENCE_LIMITS.backupCopies);
const previewFpsSchema = v.picklist(previewFpsChoices);
const backupKeepSchema = countWithin(PREFERENCE_LIMITS.backupKeep);
const bibleMaxLinesSchema = countWithin(PREFERENCE_LIMITS.bibleMaxLines);

const topLevelRanges = {
  backupCopies: backupCopiesSchema,
  previewFps: previewFpsSchema,
};

const groupRanges = {
  backup: {keep: backupKeepSchema},
  bible: {maxLines: bibleMaxLinesSchema},
};

export const textImportSplitSchema = v.picklist([
  'blankLine',
  'lineBreak',
  'symbol',
]);
export const textImportLabelsSchema = v.picklist(['bracketLine', 'off']);
export const textImportFirstLineSchema = v.picklist(['title', 'lyrics']);
export const textImportEncodingSchema = v.picklist(['auto', 'utf-8', 'cp949']);

export const preferencesSchema = jsonObject({
  format: v.literal(PREFERENCES_FORMAT),
  schemaVersion: positiveInteger,
  language: v.exactOptional(v.picklist(['ko'])),
  onLaunch: v.exactOptional(v.picklist(['lastService'])),
  backupCopies: v.exactOptional(backupCopiesSchema),
  showOnLaunch: optionalBoolean,
  preventSleep: optionalBoolean,
  alwaysOnTop: optionalBoolean,
  onDisconnect: v.exactOptional(v.picklist(['window', 'off'])),
  hardwareAcceleration: optionalBoolean,
  previewFps: v.exactOptional(previewFpsSchema),
  clearKeys: v.exactOptional(
    v.pipe(
      v.record(v.picklist(clearKeyTargets), clearFadeSchema),
      v.maxEntries(clearKeyTargets.length),
    ),
  ),
  show: v.exactOptional(jsonObject({showClearUndoButton: optionalBoolean})),
  backup: v.exactOptional(
    jsonObject({
      auto: optionalBoolean,
      keep: v.exactOptional(backupKeepSchema),
    }),
  ),
  media: v.exactOptional(jsonObject({copyOnImport: optionalBoolean})),
  bible: v.exactOptional(
    jsonObject({
      verseNumbers: optionalBoolean,
      maxLines: v.exactOptional(bibleMaxLinesSchema),
      sourcePosition: v.exactOptional(v.picklist(['bottomRight'])),
    }),
  ),
  import: v.exactOptional(
    jsonObject({
      txt: v.exactOptional(
        jsonObject({
          split: v.exactOptional(textImportSplitSchema),
          labels: v.exactOptional(textImportLabelsSchema),
          firstLine: v.exactOptional(textImportFirstLineSchema),
          encoding: v.exactOptional(textImportEncodingSchema),
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
  prune: dropValuesOutOfRange,
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
export type Preferences = Omit<Complete<PreferencesFile>, 'clearKeys'> & {
  readonly clearKeys: NonNullable<PreferencesFile['clearKeys']>;
};

/** Every 환경설정 default of `docs/spec/02-data.md`, as a complete file. */
export const defaultPreferences: Preferences = {
  clearKeys: {},
  format: PREFERENCES_FORMAT,
  schemaVersion: 1,
  language: 'ko',
  onLaunch: 'lastService',
  backupCopies: 10,
  showOnLaunch: false,
  preventSleep: true,
  alwaysOnTop: false,
  onDisconnect: 'window',
  hardwareAcceleration: true,
  previewFps: 30,
  show: {showClearUndoButton: false},
  backup: {auto: true, keep: 30},
  media: {copyOnImport: false},
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
    show: {...defaultPreferences.show, ...stored.show},
    backup: {...defaultPreferences.backup, ...stored.backup},
    media: {...defaultPreferences.media, ...stored.media},
    bible: {...defaultPreferences.bible, ...stored.bible},
    import: {
      ...stored.import,
      txt: {...defaultPreferences.import.txt, ...stored.import?.txt},
    },
  };
}

/** Checks a preferences read reply and fills the same defaults as main. */
export function parsePreferencesValue(
  value: unknown,
): Result<Preferences, PayloadError> {
  const parsed = checkPart(preferencesSchema, value);
  return parsed.ok
    ? {ok: true, value: withPreferenceDefaults(parsed.value)}
    : parsed;
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

function countWithin({min, max}: CountLimits) {
  return v.pipe(positiveInteger, v.minValue(min), v.maxValue(max));
}

// NOTE(0913vision): A count outside its range drops alone and falls back to
// its default, so one bad number never runs the whole of 환경설정 from a
// recovery copy. Writing still refuses it, through the schema.
function dropValuesOutOfRange(
  content: Readonly<Record<string, unknown>>,
): PrunedContent {
  const top = withoutInvalid(content, topLevelRanges, '');
  let kept = top.content;
  const dropped = [...top.dropped];
  for (const [group, ranges] of Object.entries(groupRanges)) {
    const part = kept[group];
    if (isRecord(part)) {
      const inner = withoutInvalid(part, ranges, `${group}.`);
      kept = {...kept, [group]: inner.content};
      dropped.push(...inner.dropped);
    }
  }
  return {content: kept, dropped};
}

// NOTE(0913vision): Only the range table's own names are looked up, so an
// unknown field named like an Object member, such as `constructor`, is kept as
// it is. `Object.fromEntries` keeps every field an own data property.
function withoutInvalid(
  part: Readonly<Record<string, unknown>>,
  ranges: Readonly<Record<string, v.GenericSchema>>,
  prefix: string,
): PrunedContent {
  const kept: Array<[string, unknown]> = [];
  const dropped: DroppedValue[] = [];
  for (const [key, value] of Object.entries(part)) {
    const schema = Object.hasOwn(ranges, key) ? ranges[key] : undefined;
    const checked = schema === undefined ? null : checkPart(schema, value);
    if (checked === null || checked.ok) {
      kept.push([key, value]);
    } else {
      dropped.push({field: `${prefix}${key}`, message: checked.error.message});
    }
  }
  return {content: Object.fromEntries(kept), dropped};
}
