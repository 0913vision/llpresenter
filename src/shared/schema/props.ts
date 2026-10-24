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
import {mediaIdSchema, propIdSchema, screenIdSchema} from './ids';
import type {MigrationStep} from './migration';
import {listWithUniqueIds, positiveInteger} from './primitives';
import {lyricTextEntries} from './textStyle';

const propSchema = v.looseObject({
  id: propIdSchema,
  name: v.string(),
  content: v.variant('kind', [
    v.looseObject({kind: v.literal('image'), media: mediaIdSchema}),
    v.looseObject({
      kind: v.literal('text'),
      text: v.string(),
      style: v.looseObject(lyricTextEntries),
    }),
  ]),
  targets: v.array(screenIdSchema),
});

const propsSchema = v.looseObject({
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
