import {slideTransitionSchema} from './slideTransition';
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
import {mediaIdSchema, songIdSchema, songSlideIdSchema} from './ids';
import {
  jsonObject,
  listWithUniqueIds,
  nonBlankText,
  positiveInteger,
  timestamp,
} from './primitives';
import {slideHotKeySchema} from './slideHotKey';

export const SONG_NAME_MAX_LENGTH = 512;

export const SONG_SCHEMA_VERSION = 1;
export const SONG_LIMITS = {slides: 10_000, label: 64} as const;

export const songSlideSchema = jsonObject({
  id: songSlideIdSchema,
  lines: v.array(v.string()),
  label: v.exactOptional(
    v.pipe(
      v.string(),
      v.trim(),
      v.minLength(1),
      v.maxLength(SONG_LIMITS.label),
    ),
  ),
  transition: v.exactOptional(slideTransitionSchema),
  hotKey: v.exactOptional(slideHotKeySchema),
});

/** Item decks may be empty; library songs contain at least one slide. */
export const songSlidesSchema = v.pipe(
  listWithUniqueIds(songSlideSchema),
  v.maxLength(SONG_LIMITS.slides),
  v.check(slides => {
    const keys = slides.flatMap(slide =>
      slide.hotKey === undefined ? [] : [slide.hotKey],
    );
    return new Set(keys).size === keys.length;
  }, 'Another slide already uses this hot key'),
);

export const songSchema = jsonObject({
  format: v.literal('llsong'),
  schemaVersion: positiveInteger,
  id: songIdSchema,
  title: nonBlankText,
  background: v.exactOptional(mediaIdSchema),
  slides: v.pipe(songSlidesSchema, v.minLength(1)),
  updatedAt: v.exactOptional(timestamp),
});

const songFormat: FileFormat<typeof songSchema> = {
  format: 'llsong',
  schema: songSchema,
  migrations: [],
};

export type Song = ReadonlyKnown<v.InferOutput<typeof songSchema>>;
export type SongSlide = Song['slides'][number];

export function sourceSlideCount(song: Song): number {
  return song.slides.length;
}

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
