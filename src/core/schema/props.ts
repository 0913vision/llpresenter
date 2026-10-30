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
import {mediaIdSchema, propIdSchema, screenIdSchema} from './ids';
import type {MigrationStep} from './migration';
import {jsonObject, listWithUniqueIds, positiveInteger} from './primitives';
import {lyricTextEntries} from './textStyle';

export const propContentSchema = v.variant('kind', [
  v.looseObject({kind: v.literal('image'), media: mediaIdSchema}),
  v.looseObject({
    kind: v.literal('text'),
    text: v.string(),
    style: jsonObject(lyricTextEntries),
  }),
]);

const propSchema = jsonObject({
  id: propIdSchema,
  name: v.string(),
  content: propContentSchema,
  targets: v.array(screenIdSchema),
});

export const propsSchema = jsonObject({
  format: v.literal('llsettings.props'),
  schemaVersion: positiveInteger,
  props: listWithUniqueIds(propSchema),
});

const propsMigrations: readonly MigrationStep[] = [];

const propsFormat: FileFormat<typeof propsSchema> = {
  format: 'llsettings.props',
  schema: propsSchema,
  migrations: propsMigrations,
};

/** `props.json`: the 소품. */
export type PropsFile = ReadonlyKnown<v.InferOutput<typeof propsSchema>>;

/**
 * One 소품: an image, or text drawn with lyric style fields. A
 * `{timer:<타이머 id>}` token in the text draws that 타이머's value.
 */
export type Prop = PropsFile['props'][number];

export function parseProps(
  text: string,
  file: string,
): Result<LoadedFile<PropsFile>, FileError> {
  return parseFile(propsFormat, text, file);
}

export function serializeProps(
  props: PropsFile,
  file: string,
): Result<string, FileError> {
  return serializeFile(propsFormat, props, file);
}
