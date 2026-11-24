import {isRecord, type UnknownRecord} from '@core/common/guards';
import type {Slide} from '../slides/slide';

/** The texts and hymn a slide needs to be read as a title slide. */
type TitleLike = Pick<Slide, 'texts' | 'hymn'>;

/**
 * Whether a slide shows a song's title: a hymn title, or a 제목 text without
 * lyrics.
 */
export function isTitleSlide(slide: TitleLike): boolean {
  if (slide.hymn !== undefined) return true;
  const title = slide.texts['제목']?.trim() ?? '';
  const lyrics = slide.texts['가사']?.trim() ?? '';
  return title !== '' && lyrics === '';
}

/** A song's own title slide, apart from its other slides. */
export interface SongParts<TSlide extends {readonly label?: string}> {
  readonly titleSlide: Omit<TSlide, 'label'> | undefined;
  readonly slides: readonly TSlide[];
}

/**
 * Splits the slides of a song into its title slide and the rest (USER Nov 25,
 * `team/song-title-design.md`): the first title slide is the song's title,
 * without its label, because the 예배 순서 gives the titles their 이름표; a
 * title slide at the very end goes, because the 예배 순서 adds the closing
 * title; every other slide stays where it is.
 */
export function splitSongTitle<
  TSlide extends TitleLike & {readonly label?: string},
>(slides: readonly TSlide[]): SongParts<TSlide> {
  const first = slides.findIndex(isTitleSlide);
  const found = slides[first];
  if (found === undefined) return {titleSlide: undefined, slides};
  const {label: _label, ...titleSlide} = found;
  const last = slides.length - 1;
  const rest = slides.filter(
    (slide, index) =>
      index !== first &&
      !(index === last && last > first && isTitleSlide(slide)),
  );
  return {titleSlide, slides: rest};
}

interface RawSlide {
  readonly texts: Readonly<Record<string, string>>;
  readonly hymn?: NonNullable<Slide['hymn']>;
  readonly label?: string;
}

/** A slide of a file not checked yet, as far as the split needs it. */
function isRawSlide(value: unknown): value is RawSlide {
  if (!isRecord(value) || !isRecord(value['texts'])) return false;
  return Object.values(value['texts']).every(text => typeof text === 'string');
}

/**
 * Song file version 1 to 2: the title slide moves out of the slides. A file
 * whose slides are not a list of slides is left as it is, for the schema to
 * refuse.
 */
export function songFileWithTitleSlide(file: UnknownRecord): UnknownRecord {
  const slides = file['slides'];
  if (!Array.isArray(slides) || !slides.every(isRawSlide)) return file;
  const parts = splitSongTitle(slides);
  return {
    ...file,
    ...(parts.titleSlide === undefined ? {} : {titleSlide: parts.titleSlide}),
    slides: parts.slides,
  };
}
