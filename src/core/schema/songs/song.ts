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
import {slideSchema, slidesSchema, type Slide} from '../slides/slide';
import {songFileWithTitleSlide, splitSongTitle} from './songTitle';

/** The longest song title, in characters. */
export const SONG_NAME_MAX_LENGTH = 512;
/** The version of the song file this app writes. */
export const SONG_SCHEMA_VERSION = 2;

/**
 * A song as its file holds it (`Songs/<id>.llsong`): its own title slide,
 * without an 이름표, apart from its other slides (version 2). It has a title
 * slide or at least one other slide.
 */
export const songSchema = v.pipe(
  jsonObject({
    format: v.literal('llsong'),
    schemaVersion: positiveInteger,
    id: songIdSchema,
    title: nonBlankText,
    titleSlide: v.exactOptional(slideSchema),
    slides: slidesSchema,
    updatedAt: v.exactOptional(timestamp),
  }),
  v.check(
    song => song.titleSlide !== undefined || song.slides.length > 0,
    'Expected a title slide or another slide',
  ),
);

const songFormat: FileFormat<typeof songSchema> = {
  format: 'llsong',
  schema: songSchema,
  migrations: [songFileWithTitleSlide],
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

/**
 * The slides of a song as it reads, its title slide first: what the library
 * shows, searches and edits.
 */
export function songSlidesOf(
  song: Pick<Song, 'titleSlide' | 'slides'>,
): readonly Slide[] {
  return song.titleSlide === undefined
    ? song.slides
    : [song.titleSlide, ...song.slides];
}

/**
 * The song with these slides, read title first, kept as its file keeps them:
 * the slide that opens it with its title is the song's title, without its
 * 이름표, and a title at the very end goes, because the 예배 순서 adds the
 * closing title (`team/song-title-design.md`, {@link splitSongTitle}).
 */
export function withSongSlides(song: Song, slides: readonly Slide[]): Song {
  const {titleSlide: _old, ...rest} = song;
  return {...rest, ...songPartsOf(slides, song.title)};
}

/**
 * The title slide and the other slides a song file keeps for the slides of
 * the song `title` read title first, as {@link withSongSlides} splits them.
 */
export function songPartsOf(
  slides: readonly Slide[],
  title: string,
): Pick<Song, 'titleSlide' | 'slides'> {
  const parts = splitSongTitle(slides, title);
  return {
    ...(parts.titleSlide === undefined ? {} : {titleSlide: parts.titleSlide}),
    slides: parts.slides,
  };
}
