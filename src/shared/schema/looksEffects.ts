import * as v from 'valibot';
import type {Result} from '../result';
import {
  checkPart,
  parseFile,
  serializeFile,
  type FileError,
  type FileFormat,
  type LoadedFile,
  type ReadonlyKnown,
} from './fileFormat';
import {
  lookEntries,
  looksEntries,
  looksSchema,
  lyricStyleEntries,
  screenLookEntries,
} from './looks';
import {messageStyleIdSchema, screenIdSchema} from './ids';
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
  ...lookEntries,
  screens: jsonRecord(screenIdSchema, screenWithMessageSchema),
});

export const looksEffectsSchema = jsonObject({
  ...looksEntries,
  schemaVersion: v.pipe(positiveInteger, v.minValue(2)),
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

function archiveField(
  fields: Readonly<Record<string, unknown>>,
  key: string,
): Record<string, unknown> {
  if (!Object.hasOwn(fields, key)) return {...fields};
  const {[key]: value, legacyV1, ...rest} = fields;
  return {
    ...rest,
    legacyV1: {
      ...(Object.hasOwn(fields, 'legacyV1') ? {legacyV1} : {}),
      [key]: value,
    },
  };
}

const migrations: readonly MigrationStep[] = [
  file => {
    const old = checkPart(looksSchema, file);
    if (!old.ok) throw new Error(`${old.error.field}: ${old.error.message}`);
    return {
      ...archiveField(old.value, 'messageStyles'),
      looks: old.value.looks.map(look => ({
        ...look,
        screens: Object.fromEntries(
          Object.entries(look.screens).map(([id, screen]) => [
            id,
            archiveField(screen, 'messageStyle'),
          ]),
        ),
      })),
      lyricStyles: old.value.lyricStyles.map(style => {
        const {referencePosition, legacyV1, ...rest} = style;
        return {
          ...rest,
          ...(Object.hasOwn(style, 'referencePosition')
            ? {
                legacyV1: {
                  ...(Object.hasOwn(style, 'legacyV1') ? {legacyV1} : {}),
                  referencePosition,
                },
              }
            : Object.hasOwn(style, 'legacyV1')
              ? {legacyV1}
              : {}),
          outline: {on: style.outline, width: 3, color: '#000000'},
          shadow: {
            on: style.shadow,
            blur: 8,
            distance: 4,
            angle: 45,
            opacity: 60,
            color: '#000000',
          },
          referencePosition: 'bottomRight',
        };
      }),
    };
  },
];

const format: FileFormat<typeof looksEffectsSchema> = {
  format: 'llsettings.looks',
  schema: looksEffectsSchema,
  migrations,
};

/** The next Looks format; activation waits for its consumers. */
export type LooksEffectsFile = ReadonlyKnown<
  v.InferOutput<typeof looksEffectsSchema>
>;

export type MessageStyle = NonNullable<
  LooksEffectsFile['messageStyles']
>[number];
export type MessageScreenLook =
  LooksEffectsFile['looks'][number]['screens'][keyof LooksEffectsFile['looks'][number]['screens']];

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

/** Resolves a screen's style, including missing styles from older files. */
export function messageStyleForScreen(
  file: LooksEffectsFile,
  screen: MessageScreenLook,
): MessageStyle {
  return (
    file.messageStyles?.find(style => style.id === screen.messageStyle) ??
    DEFAULT_MESSAGE_STYLE
  );
}

/** Reads v2 effects or migrates a complete validated v1 Looks file in memory. */
export function parseLooksEffects(
  text: string,
  file: string,
): Result<LoadedFile<LooksEffectsFile>, FileError> {
  return parseFile(format, text, file);
}

/** Validates and writes only the next Looks format. */
export function serializeLooksEffects(
  value: LooksEffectsFile,
  file: string,
): Result<string, FileError> {
  return serializeFile(format, value, file);
}
