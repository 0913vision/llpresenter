import * as v from 'valibot';
import type {Result} from '@core/common/result';
import {
  parseFile,
  serializeFile,
  type FileError,
  type FileFormat,
  type LoadedFile,
  type ReadonlyKnown,
} from '../common/fileFormat';
import {songIdSchema} from '../common/ids';
import {
  jsonObject,
  nonBlankText,
  positiveInteger,
  timestamp,
} from '../common/primitives';
import {slidesSchema} from '../slides/slide';

export const SONG_NAME_MAX_LENGTH = 512;
export const SONG_SCHEMA_VERSION = 1;

export const songSchema = jsonObject({
  format: v.literal('llsong'),
  schemaVersion: positiveInteger,
  id: songIdSchema,
  title: nonBlankText,
  slides: v.pipe(slidesSchema, v.minLength(1)),
  updatedAt: v.exactOptional(timestamp),
});

const songFormat: FileFormat<typeof songSchema> = {
  format: 'llsong',
  schema: songSchema,
  migrations: [],
};

export type Song = ReadonlyKnown<v.InferOutput<typeof songSchema>>;

export function parseSong(
  text: string,
  file: string,
): Result<LoadedFile<Song>, FileError> {
  return parseFile(songFormat, text, file);
}

export function serializeSong(
  song: Song,
  file: string,
): Result<string, FileError> {
  return serializeFile(songFormat, song, file);
}
