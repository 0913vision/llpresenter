import type {TextImportDraft} from '../schema/textImport';
import type {Slide} from '../schema/slide';
import type {SlideBackground} from '../schema/theme';
import {LIGHT_SONG_THEME_IDS} from '../theme/builtIn/ids';
import {makeSlide, type SlideMaking} from './make';

/** The slides of a song that was imported, its title slide first. */
export function songSlides(
  making: SlideMaking,
  draft: Pick<TextImportDraft, 'background' | 'light' | 'slides'>,
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
    if (source.titleSlide !== true) {
      return makeSlide(making, 'lyrics', {
        ...common,
        texts: textOf({가사: source.lines.join('\n')}),
        ...(draft.light === true ? {theme: LIGHT_SONG_THEME_IDS.lyrics} : {}),
      });
    }
    const count = source.titleLineCount ?? 1;
    return makeSlide(making, 'songTitle', {
      ...common,
      texts: textOf({
        제목: source.lines.slice(0, count).join('\n'),
        부제: source.lines.slice(count).join('\n'),
      }),
      ...(draft.light === true ? {theme: LIGHT_SONG_THEME_IDS.songTitle} : {}),
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
