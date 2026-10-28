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
import {mediaIdSchema, songIdSchema} from './ids';
import type {MigrationStep} from './migration';
import {
  jsonObject,
  nonBlankText,
  positiveInteger,
  timestamp,
} from './primitives';
import {uniqueNames} from './uniqueNames';

/** The name of the default 구성. It is never stored, so no 구성 may use it. */
export const DEFAULT_ARRANGEMENT_NAME = '기본';

export const slideSchema = jsonObject({
  label: v.exactOptional(v.string()),
  lines: v.array(v.string()),
});

/** A stored 구성 name: not blank, and never the default 구성's name. */
export const arrangementNameSchema = v.pipe(
  nonBlankText,
  v.notValue(
    DEFAULT_ARRANGEMENT_NAME,
    `"${DEFAULT_ARRANGEMENT_NAME}" is the default arrangement's name`,
  ),
);

const arrangementSchema = jsonObject({
  name: arrangementNameSchema,
  slides: v.array(positiveInteger),
});

export const arrangementsSchema = v.pipe(
  v.array(arrangementSchema),
  uniqueNames<v.InferOutput<typeof arrangementSchema>>(
    'Another arrangement already has this name',
  ),
);

/**
 * A song as its file holds it. A value from another process goes through
 * `checkPart`, which handles keys the way a file read does.
 */
export const songSchema = v.pipe(
  jsonObject({
    format: v.literal('llsong'),
    schemaVersion: positiveInteger,
    id: songIdSchema,
    title: nonBlankText,
    background: v.exactOptional(mediaIdSchema),
    slides: v.pipe(v.array(slideSchema), v.minLength(1)),
    arrangements: v.exactOptional(arrangementsSchema),
    updatedAt: v.exactOptional(timestamp),
  }),
  v.forward(
    v.check(
      ({slides, arrangements = []}) =>
        arrangements.every(arrangement =>
          arrangement.slides.every(number => number <= slides.length),
        ),
      'An arrangement points at a slide that does not exist',
    ),
    ['arrangements'],
  ),
);

const songMigrations: readonly MigrationStep[] = [];

const songFormat: FileFormat<typeof songSchema> = {
  format: 'llsong',
  schema: songSchema,
  migrations: songMigrations,
};

/** A song file (`.llsong`). See `docs/spec/02-data.md`. */
export type Song = ReadonlyKnown<v.InferOutput<typeof songSchema>>;

/** One 장 of a song. */
export type Slide = Song['slides'][number];

/** A named 구성: 장 numbers, starting at 1, in play order. */
export type Arrangement = NonNullable<Song['arrangements']>[number];

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
