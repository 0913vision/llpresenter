import type {SlidesItem} from '@core/schema/service';
import type {Slide} from '@core/schema/slide';
import type {SlidePurpose} from '@core/schema/theme';
import {themeOf, themeOfSlide} from '@core/theme';
import {makeSlide, type SlideMaking} from './make';

/** What the slides of an item are for, unless a slide says otherwise. */
export const PURPOSE_OF: Readonly<Record<SlidesItem['kind'], SlidePurpose>> = {
  song: 'lyrics',
  bible: 'scripture',
  sermon: 'scripture',
  liturgy: 'creed',
  notice: 'notice',
  blank: 'blank',
  media: 'media',
};

/** A slide of one of these says nothing about the slides after it. */
const ALONE: ReadonlySet<SlidePurpose> = new Set(['title', 'picture', 'media']);

/**
 * A slide to add after another: in the theme that follows it, with the same
 * background. With none before, it is what the item is made of.
 */
export function slideAfter(
  making: SlideMaking,
  before: Slide | undefined,
  kind: SlidesItem['kind'],
): Slide {
  const theme =
    before === undefined ? undefined : themeOfSlide(making.themes, before);
  if (
    before === undefined ||
    theme === undefined ||
    (ALONE.has(theme.purpose) &&
      !(theme.purpose === 'title' && kind === 'blank'))
  ) {
    return makeSlide(making, PURPOSE_OF[kind]);
  }
  const next =
    (theme.then === undefined
      ? undefined
      : themeOf(making.themes, theme.then)) ?? theme;
  return makeSlide(making, next.purpose, {
    theme: next.id,
    ...(before.background === undefined ? {} : {background: before.background}),
  });
}

/** Slides with the texts of a plain text, one for each blank row in it. */
export function slidesOfText(
  making: SlideMaking,
  text: string,
  {
    before,
    kind,
  }: {
    readonly before: Slide | undefined;
    readonly kind: SlidesItem['kind'];
  },
): readonly Slide[] {
  return splitAtBlankRows(text).map(part => {
    const slide = slideAfter(making, before, kind);
    const box = themeOfSlide(making.themes, slide).boxes.find(
      entry => entry.rows === 'many',
    );
    return box === undefined ? slide : {...slide, texts: {[box.name]: part}};
  });
}

/** The parts of a text between its blank rows. */
export function splitAtBlankRows(text: string): readonly string[] {
  return text
    .replace(/\r\n?/gu, '\n')
    .split(/\n(?:[^\S\n]*\n)+/u)
    .map(part => part.replace(/^\n+|\n+$/gu, ''))
    .filter(part => part.trim() !== '');
}
