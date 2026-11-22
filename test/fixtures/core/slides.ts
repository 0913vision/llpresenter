import * as v from 'valibot';
import {createSlideId, translationIdSchema} from '@core/schema/ids';
import type {Slide, VerseReference} from '@core/schema/slide';
import type {SlidePurpose} from '@core/schema/theme';
import {BUILT_IN_THEME_IDS} from '@core/theme/builtIn/ids';

/** The id of the sample slide of a number. */
export function slideId(number: number) {
  return createSlideId(
    `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`,
  );
}

/** A sample slide in the app's theme of a purpose. */
export function slideOf(
  number: number,
  purpose: SlidePurpose,
  slide: Partial<Slide> = {},
): Slide {
  return {
    id: slideId(number),
    theme: BUILT_IN_THEME_IDS[purpose],
    texts: {},
    ...slide,
  };
}

/** A sample slide of lyrics. */
export function lyricsSlide(
  number: number,
  text: string | readonly string[],
  more: Partial<Slide> = {},
): Slide {
  const lyrics = typeof text === 'string' ? text : text.join('\n');
  return slideOf(number, 'lyrics', {
    texts: lyrics === '' ? {} : {가사: lyrics},
    ...more,
  });
}

/** A verse of the first chapter of the Bible. */
export function verseOf(verse: number): VerseReference {
  return {
    translation: v.parse(translationIdSchema, 'krv'),
    book: 1,
    chapter: 1,
    verse,
  };
}
