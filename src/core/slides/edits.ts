import type {SlideId, ThemeId} from '../schema/ids';
import type {Slide, VerseReference} from '../schema/slide';
import type {SlideBackground} from '../schema/theme';
import type {SlideTransition} from '../schema/slideTransition';
import {copySlide} from './make';
import {verseKey} from './passageSlides';

type Ids = ReadonlySet<string>;

/** Changes the slides with these ids and keeps every other one as it is. */
export function changeSlides(
  slides: readonly Slide[],
  ids: Ids,
  change: (slide: Slide) => Slide,
): readonly Slide[] {
  const next = slides.map(slide => (ids.has(slide.id) ? change(slide) : slide));
  return next.every((slide, index) => slide === slides[index]) ? slides : next;
}

/** The slide with a text in a box; an empty one takes the box's default. */
export function withText(slide: Slide, box: string, text: string): Slide {
  const {[box]: before, ...others} = slide.texts;
  if ((before ?? '') === text) return slide;
  const {continued: _continued, ...kept} = slide;
  return {
    ...(box === '본문' ? kept : slide),
    texts: text === '' ? others : {...others, [box]: text},
  };
}

/** The slide with a text of its own for the slide before; empty for none. */
export function withNext(slide: Slide, text: string): Slide {
  const {next, ...kept} = slide;
  if ((next ?? '') === text) return slide;
  return text === '' ? kept : {...kept, next: text};
}

export function withLabel(slide: Slide, label: string | undefined): Slide {
  const value = label?.trim() ?? '';
  if ((slide.label ?? '') === value) return slide;
  const {label: _label, ...kept} = slide;
  return value === '' ? kept : {...kept, label: value};
}

export function withTheme(slide: Slide, theme: ThemeId): Slide {
  return slide.theme === theme ? slide : {...slide, theme};
}

/** The slide with a background of its own, or the theme's when absent. */
export function withBackground(
  slide: Slide,
  background: SlideBackground | undefined,
): Slide {
  const {background: _background, ...kept} = slide;
  return background === undefined ? kept : {...kept, background};
}

export function withTransition(
  slide: Slide,
  transition: SlideTransition | undefined,
): Slide {
  const {transition: _transition, ...kept} = slide;
  return transition === undefined ? kept : {...kept, transition};
}

export function insertSlides(
  slides: readonly Slide[],
  at: number,
  added: readonly Slide[],
): readonly Slide[] {
  return [...slides.slice(0, at), ...added, ...slides.slice(at)];
}

/** New slides after a copied or cut selection, with identities of their own. */
export function pasteSlides(
  slides: readonly Slide[],
  at: number,
  copied: readonly Slide[],
): {readonly slides: readonly Slide[]; readonly added: readonly Slide[]} {
  const added = copied.map(copySlide);
  return {slides: insertSlides(slides, at, added), added};
}

export function removeSlides(
  slides: readonly Slide[],
  ids: Ids,
): readonly Slide[] {
  return slides.filter(slide => !ids.has(slide.id));
}

/** Puts the slides with these ids together at a gap of the list. */
export function moveSlides(
  slides: readonly Slide[],
  ids: Ids,
  gap: number,
): readonly Slide[] {
  const rest = (part: readonly Slide[]) =>
    part.filter(slide => !ids.has(slide.id));
  return [
    ...rest(slides.slice(0, gap)),
    ...slides.filter(slide => ids.has(slide.id)),
    ...rest(slides.slice(gap)),
  ];
}

/** Puts new slides where the slides of a verse are. */
export function replaceVerse(
  slides: readonly Slide[],
  verse: VerseReference,
  replacement: readonly Slide[],
): readonly Slide[] {
  const at = slides.findIndex(slide => isOfVerse(slide, verse));
  if (at < 0) return slides;
  const rest = slides.filter(slide => !isOfVerse(slide, verse));
  return insertSlides(rest, at, replacement);
}

/** Puts the slides of another passage where the verses are. */
export function replacePassage(
  slides: readonly Slide[],
  passage: readonly Slide[],
): readonly Slide[] {
  const first = slides.findIndex(slide => slide.verse !== undefined);
  const kept = slides.filter(slide => slide.verse === undefined);
  const at =
    first < 0
      ? Math.min(1, kept.length)
      : slides.slice(0, first).filter(slide => slide.verse === undefined)
          .length;
  return insertSlides(kept, at, passage);
}

export function isOfVerse(slide: Slide, verse: VerseReference): boolean {
  return slide.verse !== undefined && sameVerse(slide.verse, verse);
}

export function sameVerse(a: VerseReference, b: VerseReference): boolean {
  return a.translation === b.translation && verseKey(a) === verseKey(b);
}

/** The slide with a hot key, which no other slide of the list keeps. */
export function assignHotKey(
  slides: readonly Slide[],
  id: SlideId,
  hotKey: string | undefined,
): readonly Slide[] {
  return slides.map(slide => {
    const {hotKey: own, ...kept} = slide;
    if (slide.id === id) return hotKey === undefined ? kept : {...kept, hotKey};
    return own !== undefined && own === hotKey ? kept : slide;
  });
}

/** The texts of slides as plain text, one blank row between slides. */
export function slidesText(slides: readonly Slide[]): string {
  return slides
    .map(slide => Object.values(slide.texts).join('\n'))
    .join('\n\n');
}
