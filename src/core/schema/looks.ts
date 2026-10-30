import * as v from 'valibot';
import type {Result} from '../common/result';
import {
  parseFile,
  serializeFile,
  type FileError,
  type FileFormat,
  type LoadedFile,
  type ReadonlyKnown,
} from './fileFormat';
import {
  lookIdSchema,
  lyricStyleIdSchema,
  messageStyleIdSchema,
  screenIdSchema,
  stageLayoutIdSchema,
} from './ids';
import type {MigrationStep} from './migration';
import {
  hexColor,
  jsonObject,
  jsonRecord,
  listWithUniqueIds,
  nonNegativeNumber,
  percent,
  positiveInteger,
} from './primitives';
import {textStyleEntries} from './textStyle';

const optionalLayer = v.exactOptional(v.boolean());

export const screenLookEntries = {
  layers: jsonObject({
    media: optionalLayer,
    slide: optionalLayer,
    notice: optionalLayer,
    prop: optionalLayer,
    message: optionalLayer,
    clock: optionalLayer,
    stageMessage: optionalLayer,
  }),
  lyricStyle: v.exactOptional(lyricStyleIdSchema),
  stageLayout: v.exactOptional(stageLayoutIdSchema),
  background: v.exactOptional(
    v.variant('kind', [
      v.looseObject({kind: v.literal('media')}),
      v.looseObject({kind: v.literal('color'), color: hexColor}),
    ]),
  ),
};

const lyricStyleEntries = {
  id: lyricStyleIdSchema,
  name: v.string(),
  ...textStyleEntries,
  maxLines: positiveInteger,
  margin: percent,
};

export const LYRIC_EFFECT_LIMITS = {
  outlineWidth: {min: 1, max: 10},
  shadowBlur: 40,
  shadowDistance: 20,
  shadowAngle: 360,
} as const;

const outlineSchema = jsonObject({
  on: v.boolean(),
  width: v.pipe(
    nonNegativeNumber,
    v.minValue(LYRIC_EFFECT_LIMITS.outlineWidth.min),
    v.maxValue(LYRIC_EFFECT_LIMITS.outlineWidth.max),
  ),
  color: hexColor,
});

const shadowSchema = jsonObject({
  on: v.boolean(),
  blur: v.pipe(nonNegativeNumber, v.maxValue(LYRIC_EFFECT_LIMITS.shadowBlur)),
  distance: v.pipe(
    nonNegativeNumber,
    v.maxValue(LYRIC_EFFECT_LIMITS.shadowDistance),
  ),
  angle: v.pipe(nonNegativeNumber, v.maxValue(LYRIC_EFFECT_LIMITS.shadowAngle)),
  opacity: percent,
  color: hexColor,
});

const effectStyleSchema = jsonObject({
  ...lyricStyleEntries,
  outline: outlineSchema,
  shadow: shadowSchema,
  referencePosition: v.picklist([
    'bottomRight',
    'bottomLeft',
    'afterLastLine',
    'hidden',
  ]),
});

export const MESSAGE_STYLE_LIMIT = 1000;

const messageStyleSchema = jsonObject({
  ...lyricStyleEntries,
  id: messageStyleIdSchema,
  outline: outlineSchema,
  shadow: shadowSchema,
  background: v.exactOptional(jsonObject({color: hexColor, opacity: percent})),
});

const screenWithMessageSchema = jsonObject({
  ...screenLookEntries,
  messageStyle: v.exactOptional(messageStyleIdSchema),
});

const lookWithMessageSchema = jsonObject({
  id: lookIdSchema,
  name: v.string(),
  screens: jsonRecord(screenIdSchema, screenWithMessageSchema),
});

export const looksSchema = jsonObject({
  format: v.literal('llsettings.looks'),
  schemaVersion: positiveInteger,
  current: lookIdSchema,
  lyricStyles: listWithUniqueIds(effectStyleSchema),
  looks: listWithUniqueIds(lookWithMessageSchema),
  messageStyles: v.exactOptional(
    v.pipe(
      v.array(messageStyleSchema),
      v.maxLength(MESSAGE_STYLE_LIMIT),
      v.check(
        items => new Set(items.map(item => item.id)).size === items.length,
        'Another style already has this id',
      ),
    ),
  ),
});

const migrations: readonly MigrationStep[] = [];

const format: FileFormat<typeof looksSchema> = {
  format: 'llsettings.looks',
  schema: looksSchema,
  migrations,
};

/** The active Looks format. */
export type LooksFile = ReadonlyKnown<v.InferOutput<typeof looksSchema>>;

export type Look = LooksFile['looks'][number];
export type ScreenLook = Look['screens'][keyof Look['screens']];
export type LyricStyle = LooksFile['lyricStyles'][number];

export type MessageStyle = NonNullable<LooksFile['messageStyles']>[number];
export type MessageScreenLook =
  LooksFile['looks'][number]['screens'][keyof LooksFile['looks'][number]['screens']];

/** The fixed appearance used before a screen chooses a message style. */
export const DEFAULT_MESSAGE_STYLE: MessageStyle = v.parse(messageStyleSchema, {
  id: '00000000-0000-4000-8000-000000000001',
  name: '기본',
  font: 'Pretendard',
  weight: 700,
  size: 84,
  color: '#FFFFFF',
  align: 'center',
  vAlign: 'middle',
  lineHeight: 1.4,
  maxLines: 2,
  margin: 6,
  outline: {on: false, width: 3, color: '#000000'},
  shadow: {
    on: true,
    blur: 8,
    distance: 4,
    angle: 45,
    opacity: 60,
    color: '#000000',
  },
});

/** Resolves a screen's style, including an absent or missing style. */
export function messageStyleForScreen(
  file: LooksFile,
  screen: MessageScreenLook,
): MessageStyle {
  return (
    file.messageStyles?.find(style => style.id === screen.messageStyle) ??
    DEFAULT_MESSAGE_STYLE
  );
}

/** Reads and validates the Looks file. */
export function parseLooks(
  text: string,
  file: string,
): Result<LoadedFile<LooksFile>, FileError> {
  return parseFile(format, text, file);
}

/** Validates and writes the Looks file. */
export function serializeLooks(
  value: LooksFile,
  file: string,
): Result<string, FileError> {
  return serializeFile(format, value, file);
}
