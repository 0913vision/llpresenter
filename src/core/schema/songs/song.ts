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

/** The longest song title, in characters. */
export const SONG_NAME_MAX_LENGTH = 512;
/** The version of the song file this app writes. */
export const SONG_SCHEMA_VERSION = 1;

/**
 * A song as its file holds it (`Songs/<id>.llsong`); it has at least one slide.
 */
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

/** A song file (`.llsong`). See `docs/spec/02-data.md`. */
export type Song = ReadonlyKnown<v.InferOutput<typeof songSchema>>;

/** Reads the text of a song file. `file` names it in errors. */
export function parseSong(
  text: string,
  file: string,
): Result<LoadedFile<Song>, FileError> {
  return parseFile(songFormat, text, file);
}

/** Writes a song as the text of its file. `file` names it in errors. */
export function serializeSong(
  song: Song,
  file: string,
): Result<string, FileError> {
  return serializeFile(songFormat, song, file);
}
