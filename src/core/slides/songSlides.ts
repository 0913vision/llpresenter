import type {TextImportDraft} from '@core/schema/textImport';
import type {Hymn} from '@core/schema/hymn';
import type {Slide} from '@core/schema/slide';
import type {SlideBackground} from '@core/schema/theme';
import {SONG_THEME_IDS} from '@core/theme';
import {hymnAt, hymnLabel, hymnTitle, isTitleOf} from '@core/hymns';
import {makeSlide, type SlideMaking} from './make';

type ImportedSlide = TextImportDraft['slides'][number];

/** What the title slide of a song says. */
interface SongTitle {
  readonly hymn: Hymn | null;
  readonly title: string;
  readonly subtitle: string;
}

/** Reads a title slide; a hymn is known by its number. */
function titleOf({lines, titleLineCount: count = 1}: ImportedSlide): SongTitle {
  const rows = lines.map(row => row.trim()).filter(row => row !== '');
  const at = rows.findIndex(row => hymnAt(row) !== null);
  const named = hymnAt(rows[at] ?? '');
  if (named !== null) {
    const [title = '', ...rest] = [named.rest, ...rows.toSpliced(at, 1)].filter(
      row => row !== '',
    );
    if (rest.length === 0) return {hymn: named.hymn, title, subtitle: ''};
  }
  return {
    hymn: null,
    title: lines.slice(0, count).join('\n'),
    subtitle: lines.slice(count).join('\n'),
  };
}

/** The name of the song that a title slide is of. */
export function importedSongTitle(slide: ImportedSlide): string {
  const {hymn, title} = titleOf(slide);
  const name = title.split('\n').join(' ').trim();
  if (hymn === null) return name;
  return `${hymnLabel(hymn)} ${name || hymnTitle(hymn)}`;
}

function titleSlide(
  making: SlideMaking,
  source: ImportedSlide,
  common: Partial<Slide>,
): Slide {
  const {hymn, title, subtitle} = titleOf(source);
  const light = source.light === true;
  if (hymn === null) {
    return makeSlide(making, 'songTitle', {
      ...common,
      texts: textOf({제목: title, 부제: subtitle}),
      ...(light ? {theme: SONG_THEME_IDS.light.title} : {}),
    });
  }
  // NOTE(0913vision): The theme writes the hymn and its title in the hymnal, so
  // only a title with other words is a text of the slide.
  return makeSlide(making, 'songTitle', {
    ...common,
    hymn,
    texts: textOf({제목: isTitleOf(hymn, title) ? '' : title}),
    theme: (light ? SONG_THEME_IDS.light : SONG_THEME_IDS.dark).hymnTitle,
  });
}

/** The slides of a song that was imported, its title slide first. */
export function songSlides(
  making: SlideMaking,
  draft: Pick<TextImportDraft, 'background' | 'slides'>,
): readonly Slide[] {
  return draft.slides.map(source => {
    const label = source.label?.trim();
    const media = source.picture ?? draft.background;
    const background: {background?: SlideBackground} =
      media === undefined ? {} : {background: {kind: 'media', media}};
    const common = {
      ...background,
      ...(label === undefined || label === '' ? {} : {label}),
    };
    if (source.titleSlide === true) return titleSlide(making, source, common);
    return makeSlide(making, 'lyrics', {
      ...common,
      texts: textOf({가사: source.lines.join('\n')}),
      ...(source.light === true ? {theme: SONG_THEME_IDS.light.lyrics} : {}),
    });
  });
}

/** Leaves out the boxes without text. */
function textOf(texts: Readonly<Record<string, string>>) {
  return Object.fromEntries(
    Object.entries(texts).filter(([, text]) => text !== ''),
  );
}

/** The slides with the new name of their song on the slide that shows it. */
export function withSongTitle(
  slides: readonly Slide[],
  from: string,
  to: string,
): readonly Slide[] {
  const shown = slides.findIndex(
    slide => slide.texts['제목']?.trim() === from.trim(),
  );
  return shown < 0
    ? slides
    : slides.map((slide, index) =>
        index === shown ? {...slide, texts: {...slide.texts, 제목: to}} : slide,
      );
}

/** The slides a new song starts with. */
export function newSongSlides(
  making: SlideMaking,
  title: string,
): readonly Slide[] {
  return [
    makeSlide(making, 'songTitle', {texts: {제목: title}}),
    makeSlide(making, 'lyrics'),
  ];
}
