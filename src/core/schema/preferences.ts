import * as v from 'valibot';
import {isRecord} from '../common/guards';
import type {Result} from '../common/result';
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
import {clearFadeSchema} from './clearFade';

const PREFERENCES_FORMAT = 'llsettings.preferences';

/** The counts 환경설정 allows (`docs/spec/10-shortcuts-and-settings.md`). */
export const PREFERENCE_LIMITS = {
  backupCopies: {min: 3, max: 50},
  backupKeep: {min: 1, max: 365},
  bibleMaxLines: {min: 1, max: 12},
} as const;

/** The most characters of an audio device id or label that is kept. */
export const AUDIO_DEVICE_LIMIT = 200;

/**
 * The audio output device a choice names: the browser's device id and the
 * label it had when chosen, so a device that comes back under another id is
 * found by its label. An empty id is the Windows default device.
 */
export const audioDeviceSchema = jsonObject({
  id: v.pipe(v.string(), v.maxLength(AUDIO_DEVICE_LIMIT)),
  label: v.pipe(v.string(), v.maxLength(AUDIO_DEVICE_LIMIT)),
});

/** The seconds a 전환 may last, as 환경설정 allows them. */
export const TRANSITION_LIMITS = {
  slide: {min: 0.1, max: 2, step: 0.1},
  media: {min: 0.1, max: 3, step: 0.1},
} as const;

/** How a slide or a background changes: not at all, or by a dissolve. */
export const transitionKindSchema = v.picklist(['none', 'dissolve']);

function transitionSeconds({min, max}: {min: number; max: number}) {
  return v.pipe(v.number(), v.finite(), v.minValue(min), v.maxValue(max));
}

const slideTransitionSchema = jsonObject({
  kind: v.exactOptional(transitionKindSchema),
  seconds: v.exactOptional(transitionSeconds(TRANSITION_LIMITS.slide)),
});
const mediaTransitionSchema = jsonObject({
  kind: v.exactOptional(transitionKindSchema),
  seconds: v.exactOptional(transitionSeconds(TRANSITION_LIMITS.media)),
});

/** The seconds the 오디오 rows allow (spec 10, 진행 page). */
export const AUDIO_LIMITS = {
  transition: {min: 0, max: 5, step: 0.1},
  fadeOut: {min: 0.5, max: 10, step: 0.5},
} as const;

function secondsWithin({min, max}: {min: number; max: number}) {
  return v.pipe(v.number(), v.finite(), v.minValue(min), v.maxValue(max));
}

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

/** What the next-슬라이드 key does on the last 슬라이드 of an item. */
export const atLastSlideSchema = v.picklist(['stop', 'nextItem']);

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
    jsonObject({
      all: v.exactOptional(clearFadeSchema),
      slide: v.exactOptional(clearFadeSchema),
      media: v.exactOptional(clearFadeSchema),
      prop: v.exactOptional(clearFadeSchema),
      audio: v.exactOptional(clearFadeSchema),
      message: v.exactOptional(clearFadeSchema),
      notice: v.exactOptional(clearFadeSchema),
    }),
  ),
  show: v.exactOptional(
    jsonObject({
      showClearUndoButton: optionalBoolean,
      atLastSlide: v.exactOptional(atLastSlideSchema),
      audio: v.exactOptional(
        jsonObject({
          transitionSeconds: v.exactOptional(
            secondsWithin(AUDIO_LIMITS.transition),
          ),
          fadeOutSeconds: v.exactOptional(secondsWithin(AUDIO_LIMITS.fadeOut)),
        }),
      ),
    }),
  ),
  backup: v.exactOptional(
    jsonObject({
      auto: optionalBoolean,
      keep: v.exactOptional(backupKeepSchema),
    }),
  ),
  output: v.exactOptional(
    jsonObject({
      transition: v.exactOptional(
        jsonObject({
          slide: v.exactOptional(slideTransitionSchema),
          media: v.exactOptional(mediaTransitionSchema),
        }),
      ),
    }),
  ),
  media: v.exactOptional(
    jsonObject({
      copyOnImport: optionalBoolean,
      audioOutput: v.exactOptional(audioDeviceSchema),
      previewOutput: v.exactOptional(audioDeviceSchema),
    }),
  ),
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

/**
 * The Windows default output device, which every audio choice starts as. The
 * label stays empty: the page shows its own text for an empty id, so the file
 * holds no wording.
 */
export const DEFAULT_AUDIO_DEVICE = {id: '', label: ''} as const;

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
  output: {
    transition: {
      slide: {kind: 'dissolve', seconds: 0.2},
      media: {kind: 'dissolve', seconds: 0.5},
    },
  },
  show: {
    showClearUndoButton: false,
    atLastSlide: 'stop',
    audio: {transitionSeconds: 0.5, fadeOutSeconds: 3},
  },
  backup: {auto: true, keep: 30},
  media: {
    copyOnImport: false,
    audioOutput: DEFAULT_AUDIO_DEVICE,
    previewOutput: DEFAULT_AUDIO_DEVICE,
  },
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
    output: {
      transition: {
        slide: {
          ...defaultPreferences.output.transition.slide,
          ...stored.output?.transition?.slide,
        },
        media: {
          ...defaultPreferences.output.transition.media,
          ...stored.output?.transition?.media,
        },
      },
    },
    show: {
      ...defaultPreferences.show,
      ...stored.show,
      audio: {...defaultPreferences.show.audio, ...stored.show?.audio},
    },
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
  const output = kept['output'];
  const transition = isRecord(output) ? output['transition'] : undefined;
  if (isRecord(output) && isRecord(transition)) {
    let changed = transition;
    for (const [name, seconds] of [
      ['slide', transitionSeconds(TRANSITION_LIMITS.slide)],
      ['media', transitionSeconds(TRANSITION_LIMITS.media)],
    ] as const) {
      const part = changed[name];
      if (!isRecord(part)) continue;
      const inner = withoutInvalid(
        part,
        {seconds},
        `output.transition.${name}.`,
      );
      changed = {...changed, [name]: inner.content};
      dropped.push(...inner.dropped);
    }
    kept = {...kept, output: {...output, transition: changed}};
  }
  const show = kept['show'];
  const audio = isRecord(show) ? show['audio'] : undefined;
  if (isRecord(show) && isRecord(audio)) {
    const inner = withoutInvalid(
      audio,
      {
        transitionSeconds: secondsWithin(AUDIO_LIMITS.transition),
        fadeOutSeconds: secondsWithin(AUDIO_LIMITS.fadeOut),
      },
      'show.audio.',
    );
    kept = {...kept, show: {...show, audio: inner.content}};
    dropped.push(...inner.dropped);
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
