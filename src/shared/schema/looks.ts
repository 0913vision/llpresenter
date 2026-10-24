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
import {
  lookIdSchema,
  lyricStyleIdSchema,
  screenIdSchema,
  stageLayoutIdSchema,
} from './ids';
import type {MigrationStep} from './migration';
import {
  hexColor,
  listWithUniqueIds,
  percent,
  positiveInteger,
} from './primitives';
import {textStyleEntries} from './textStyle';

const optionalLayer = v.exactOptional(v.boolean());

const screenLookSchema = v.looseObject({
  layers: v.looseObject({
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
});

const lookSchema = v.looseObject({
  id: lookIdSchema,
  name: v.string(),
  screens: v.record(screenIdSchema, screenLookSchema),
});

const lyricStyleSchema = v.looseObject({
  id: lyricStyleIdSchema,
  name: v.string(),
  ...textStyleEntries,
  maxLines: positiveInteger,
  margin: percent,
  shadow: v.boolean(),
  outline: v.boolean(),
});

const looksSchema = v.looseObject({
  format: v.literal('llsettings.looks'),
  schemaVersion: positiveInteger,
  current: lookIdSchema,
  looks: listWithUniqueIds(lookSchema),
  lyricStyles: listWithUniqueIds(lyricStyleSchema),
});

const looksMigrations: readonly MigrationStep[] = [];

const looksFormat: FileFormat<typeof looksSchema> = {
  format: 'llsettings.looks',
  schema: looksSchema,
  migrations: looksMigrations,
};

/**
 * `looks.json`: the Looks, the lyric styles, and the current Look. Ids that
 * point elsewhere, such as `current` or a screen's lyric style, aren't checked
 * here; the code that uses them handles a missing target.
 */
export type LooksFile = ReadonlyKnown<v.InferOutput<typeof looksSchema>>;

export type Look = LooksFile['looks'][number];

/**
 * What one screen shows under a Look. An absent layer is hidden. An absent
 * background shows the media layer.
 */
export type ScreenLook = Look['screens'][keyof Look['screens']];

export type LyricStyle = LooksFile['lyricStyles'][number];

export function parseLooks(
  text: string,
  file: string,
): Result<LoadedFile<LooksFile>, FileError> {
  return parseFile(looksFormat, text, file);
}

export function serializeLooks(
  looks: LooksFile,
  file: string,
): Result<string, FileError> {
  return serializeFile(looksFormat, looks, file);
}
