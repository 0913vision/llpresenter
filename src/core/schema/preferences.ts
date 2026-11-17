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
import {bibleReferenceSchema} from './biblePassage';
import {slideTransitionSchema, type SlideTransition} from './slideTransition';

const PREFERENCES_FORMAT = 'llsettings.preferences';

/** The counts 환경설정 allows (`docs/spec/10-shortcuts-and-settings.md`). */
export const PREFERENCE_LIMITS = {
  backupCopies: {min: 3, max: 50},
  backupKeep: {min: 1, max: 365},
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

export const transitionDefaultKinds = [
  'section',
  'sermonTitle',
  'creed',
  'prayer',
  'bible',
] as const;
export type TransitionDefaultKind = (typeof transitionDefaultKinds)[number];
export type SlideTransitionDefaults = Readonly<
  Record<TransitionDefaultKind, SlideTransition>
>;
export const defaultSlideTransitions: SlideTransitionDefaults = {
  section: {kind: 'wipe', dir: 'left', sec: 1},
  sermonTitle: {kind: 'wipe', dir: 'left', sec: 1},
  creed: {kind: 'wipe', dir: 'left', sec: 0.7},
  prayer: {kind: 'wipe', dir: 'left', sec: 0.7},
  bible: {kind: 'wipe', dir: 'left', sec: 0.7},
};

/** The seconds the 오디오 rows allow (spec 10, 진행 page). */
export const AUDIO_LIMITS = {
  transition: {min: 0, max: 5, step: 0.1},
  fadeOut: {min: 0.5, max: 10, step: 0.5},
} as const;

function secondsWithin({min, max}: {min: number; max: number}) {
  return v.pipe(v.number(), v.finite(), v.minValue(min), v.maxValue(max));
}

interface CountLimits {
  readonly min: number;
  readonly max: number;
}

const optionalBoolean = v.exactOptional(v.boolean());

/** The `fit` choices of a media item (how it fills the screen), as stored. */
export const mediaFitChoices = ['fit', 'fill', 'stretch'] as const;

const mediaDefaultsSchema = jsonObject({
  end: v.exactOptional(v.picklist(['loop', 'stop'])),
  fit: v.exactOptional(v.picklist(mediaFitChoices)),
  audio: optionalBoolean,
});
const backupCopiesSchema = countWithin(PREFERENCE_LIMITS.backupCopies);
const backupKeepSchema = countWithin(PREFERENCE_LIMITS.backupKeep);

const topLevelRanges = {
  backupCopies: backupCopiesSchema,
};

const groupRanges = {
  backup: {keep: backupKeepSchema},
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

export const stageLyricLabelPositionSchema = v.picklist([
  'line',
  'inline',
  'off',
]);
export type StageLyricLabelPosition = v.InferOutput<
  typeof stageLyricLabelPositionSchema
>;

export const preferencesSchema = jsonObject({
  format: v.literal(PREFERENCES_FORMAT),
  schemaVersion: positiveInteger,
  general: v.exactOptional(jsonObject({launchAtLogin: optionalBoolean})),
  backupCopies: v.exactOptional(backupCopiesSchema),
  showOnLaunch: optionalBoolean,
  clearKeys: v.exactOptional(
    jsonObject({
      all: v.exactOptional(clearFadeSchema),
      slide: v.exactOptional(clearFadeSchema),
      media: v.exactOptional(clearFadeSchema),
      prop: v.exactOptional(clearFadeSchema),
      audio: v.exactOptional(clearFadeSchema),
      message: v.exactOptional(clearFadeSchema),
    }),
  ),
  show: v.exactOptional(
    jsonObject({
      atLastSlide: v.exactOptional(atLastSlideSchema),
      continuousGrid: v.exactOptional(v.boolean()),
      dimPastItems: v.exactOptional(v.boolean()),
      slideDefaults: v.exactOptional(
        jsonObject({
          section: v.exactOptional(slideTransitionSchema),
          sermonTitle: v.exactOptional(slideTransitionSchema),
          creed: v.exactOptional(slideTransitionSchema),
          prayer: v.exactOptional(slideTransitionSchema),
          bible: v.exactOptional(slideTransitionSchema),
        }),
      ),
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
      stageLyricLabelPosition: v.exactOptional(stageLyricLabelPositionSchema),
    }),
  ),
  media: v.exactOptional(
    jsonObject({
      defaults: v.exactOptional(mediaDefaultsSchema),
      audioOutput: v.exactOptional(audioDeviceSchema),
      previewOutput: v.exactOptional(audioDeviceSchema),
    }),
  ),
  bible: v.exactOptional(
    jsonObject({
      defaults: v.exactOptional(
        jsonObject({
          reference: v.exactOptional(bibleReferenceSchema),
          verseNumbers: optionalBoolean,
          translationName: optionalBoolean,
        }),
      ),
      splitEditorAutoOpen: optionalBoolean,
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
export type Preferences = Omit<
  Complete<PreferencesFile>,
  'clearKeys' | 'output' | 'show'
> & {
  readonly clearKeys: NonNullable<PreferencesFile['clearKeys']>;
  readonly show: Omit<
    Complete<NonNullable<PreferencesFile['show']>>,
    'slideDefaults'
  > & {
    readonly slideDefaults: SlideTransitionDefaults;
  };
  readonly output: {
    readonly stageLyricLabelPosition: StageLyricLabelPosition;
  };
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
  general: {launchAtLogin: false},
  backupCopies: 10,
  showOnLaunch: false,
  output: {
    stageLyricLabelPosition: 'line',
  },
  show: {
    atLastSlide: 'stop',
    continuousGrid: false,
    dimPastItems: false,
    slideDefaults: defaultSlideTransitions,
    audio: {transitionSeconds: 0.5, fadeOutSeconds: 3},
  },
  backup: {auto: true, keep: 30},
  media: {
    defaults: {end: 'loop', fit: 'fill', audio: false},
    audioOutput: DEFAULT_AUDIO_DEVICE,
    previewOutput: DEFAULT_AUDIO_DEVICE,
  },
  bible: {
    defaults: {
      reference: 'every',
      verseNumbers: true,
      translationName: false,
    },
    splitEditorAutoOpen: true,
  },
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
      stageLyricLabelPosition:
        stored.output?.stageLyricLabelPosition ??
        defaultPreferences.output.stageLyricLabelPosition,
    },
    general: {...defaultPreferences.general, ...stored.general},
    show: {
      ...defaultPreferences.show,
      ...stored.show,
      slideDefaults: {
        ...defaultSlideTransitions,
        ...stored.show?.slideDefaults,
      },
      audio: {...defaultPreferences.show.audio, ...stored.show?.audio},
    },
    backup: {...defaultPreferences.backup, ...stored.backup},
    media: {
      ...defaultPreferences.media,
      ...stored.media,
      defaults: {
        ...defaultPreferences.media.defaults,
        ...stored.media?.defaults,
      },
    },
    bible: {
      ...defaultPreferences.bible,
      ...stored.bible,
      defaults: {
        ...defaultPreferences.bible.defaults,
        ...stored.bible?.defaults,
      },
    },
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
