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
import {looksEntries, looksSchema, lyricStyleEntries} from './looks';
import type {MigrationStep} from './migration';
import {
  hexColor,
  jsonObject,
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

export const looksEffectsSchema = jsonObject({
  ...looksEntries,
  schemaVersion: v.pipe(positiveInteger, v.minValue(2)),
  lyricStyles: listWithUniqueIds(effectStyleSchema),
});

const migrations: readonly MigrationStep[] = [
  file => {
    const old = checkPart(looksSchema, file);
    if (!old.ok) throw new Error(`${old.error.field}: ${old.error.message}`);
    return {
      ...old.value,
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
