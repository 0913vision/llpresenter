import {isRecord, type UnknownRecord} from '@core/common/guards';
import type {Slide} from '../slides/slide';

/** The 이름표 of the two titles a song gets in the 예배 순서. */
export const SONG_TITLE_LABELS = {opening: '전주', closing: '후주'} as const;

/** What a slide needs to be read as a song's title slide. */
type TitleLike = Pick<Slide, 'texts' | 'hymn'> & {
  readonly background?: unknown;
};

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

function lyricsOf(slide: TitleLike): string {
  return slide.texts['가사']?.trim() ?? '';
}

function hasNoText(slide: TitleLike): boolean {
  return Object.values(slide.texts).every(text => text.trim() === '');
}

function sameTexts(one: TitleLike, other: TitleLike): boolean {
  const keys = new Set([
    ...Object.keys(one.texts),
    ...Object.keys(other.texts),
  ]);
  return [...keys].every(
    key => (one.texts[key]?.trim() ?? '') === (other.texts[key]?.trim() ?? ''),
  );
}

/** Whether a text is only the song title, spaces aside. */
export function isTitleText(text: string, title: string): boolean {
  const normal = (value: string) => value.trim().replace(/\s+/gu, ' ');
  return normal(title) !== '' && normal(text) === normal(title);
}

/**
 * Where the song's own title slide is among its slides, or -1. Only the
 * slides before the first lyrics count, so a title inside a medley stays a
 * slide of the song. Among those: the first title slide; else the first slide
 * with no text and its own background, as a hymn's picture of its title from
 * PowerPoint is; else a first slide whose lyrics are only the song's title.
 */
function titleIndex(slides: readonly TitleLike[], title: string): number {
  const lyrics = slides.findIndex(slide => lyricsOf(slide) !== '');
  const leading = lyrics === -1 ? slides : slides.slice(0, lyrics);
  const titled = leading.findIndex(isTitleSlide);
  if (titled !== -1) return titled;
  const picture = leading.findIndex(
    slide => hasNoText(slide) && slide.background !== undefined,
  );
  if (picture !== -1) return picture;
  const first = slides[0];
  return first !== undefined && isTitleText(lyricsOf(first), title) ? 0 : -1;
}

/** A song's own title slide, apart from its other slides. */
export interface SongParts<TSlide extends {readonly label?: string}> {
  readonly titleSlide: Omit<TSlide, 'label'> | undefined;
  readonly slides: readonly TSlide[];
}

/**
 * Splits the slides of the song `title` into its title slide and the rest
 * (USER Nov 25, `team/song-title-design.md`): the slide that opens the song
 * with its title is the song's title, without its label, because the 예배
 * 순서 gives the titles their 이름표; a last slide that shows that same title
 * again, as a title slide or as a 후주 copy, goes, because the 예배 순서 adds
 * the closing title; every other slide stays where it is, another title at the
 * end and a last lyric that sings the title too.
 */
export function splitSongTitle<
  TSlide extends TitleLike & {readonly label?: string},
>(slides: readonly TSlide[], title: string): SongParts<TSlide> {
  const first = titleIndex(slides, title);
  const found = slides[first];
  if (found === undefined) return {titleSlide: undefined, slides};
  const {label: _label, ...titleSlide} = found;
  const last = slides.length - 1;
  const closing = slides[last];
  const dropsClosing =
    last > first &&
    closing !== undefined &&
    (isTitleSlide(closing) || closing.label === SONG_TITLE_LABELS.closing) &&
    sameTexts(closing, found);
  const rest = slides.filter(
    (_slide, index) => index !== first && !(dropsClosing && index === last),
  );
  return {titleSlide, slides: rest};
}

interface RawSlide {
  readonly texts: Readonly<Record<string, string>>;
  readonly hymn?: NonNullable<Slide['hymn']>;
  readonly background?: unknown;
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
  const title = typeof file['title'] === 'string' ? file['title'] : '';
  const parts = splitSongTitle(slides, title);
  return {
    ...file,
    ...(parts.titleSlide === undefined ? {} : {titleSlide: parts.titleSlide}),
    slides: parts.slides,
  };
}
