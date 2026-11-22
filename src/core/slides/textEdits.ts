import type {SlideId} from '@core/schema/ids';
import {SLIDE_LIMITS, type Slide} from '@core/schema/slide';
import {themeOfSlide} from '@core/theme';
import {sameVerse} from './edits';
import {copySlide, transitionFor, type SlideMaking} from './make';

/** A place in the text of a box of one slide. */
export interface TextPlace {
  readonly id: SlideId;
  readonly box: string;
  readonly start: number;
  readonly end: number;
}

/** The slides after an edit, and where the caret goes on. */
export interface TextEdit {
  readonly slides: readonly Slide[];
  readonly caret: {readonly id: SlideId; readonly at: number};
}

const BLANK_ROWS = /\n(?:[^\S\n]*\n)+/gu;

function textOf(slide: Slide, box: string): string {
  return slide.texts[box] ?? '';
}

function withBox(slide: Slide, box: string, text: string): Slide {
  const {[box]: _text, ...others} = slide.texts;
  return {...slide, texts: text === '' ? others : {...others, [box]: text}};
}

/** A slide over as many slides as the text of one of its boxes has parts. */
function cutInto(
  making: SlideMaking,
  slide: Slide,
  {box, parts}: {readonly box: string; readonly parts: readonly string[]},
): readonly Slide[] {
  const purpose = themeOfSlide(making.themes, slide).purpose;
  const {continued, ...whole} = slide;
  return parts.map((part, index) => {
    const own: Slide =
      index === 0
        ? whole
        : {
            ...copySlide(whole),
            transition: transitionFor(making, purpose),
          };
    const goesOn =
      index < parts.length - 1 ? slide.verse !== undefined : continued === true;
    return {
      ...withBox(own, box, part),
      ...(goesOn ? {continued: true as const} : {}),
    };
  });
}

function replaceSlide(
  slides: readonly Slide[],
  id: SlideId,
  added: readonly Slide[],
): readonly Slide[] {
  return slides.flatMap(slide => (slide.id === id ? added : [slide]));
}

/** Cuts a slide in two at a place in its text. */
export function splitSlide(
  making: SlideMaking,
  slides: readonly Slide[],
  {id, box, start, end}: TextPlace,
): TextEdit | null {
  const slide = slides.find(entry => entry.id === id);
  if (slide === undefined || slides.length >= SLIDE_LIMITS.slides) return null;
  const text = textOf(slide, box);
  const collapsed = start === end;
  const before =
    collapsed && start > 0 && text[start] !== '\n' && text[start - 1] === '\n'
      ? start - 1
      : start;
  const after = collapsed && text[end] === '\n' ? end + 1 : end;
  const added = cutInto(making, slide, {
    box,
    parts: [
      text.slice(0, before).trimEnd(),
      text.slice(after).replace(/^ +/u, ''),
    ],
  });
  const second = added[1];
  return second === undefined
    ? null
    : {
        slides: replaceSlide(slides, id, added),
        caret: {id: second.id, at: 0},
      };
}

/** Joins a slide to the one before it, when both are drawn with one theme. */
export function joinSlide(
  slides: readonly Slide[],
  id: SlideId,
  box: string,
): TextEdit | null {
  const index = slides.findIndex(entry => entry.id === id);
  const slide = slides[index];
  const previous = slides[index - 1];
  if (slide === undefined || previous?.theme !== slide.theme) return null;
  const oneVerse =
    slide.verse !== undefined &&
    previous.verse !== undefined &&
    sameVerse(slide.verse, previous.verse);
  const first = textOf(previous, box);
  const second = textOf(slide, box);
  const joined = [first, second]
    .filter(text => text !== '')
    .join(oneVerse ? ' ' : '\n');
  if (joined.length > SLIDE_LIMITS.text) return null;
  const {continued: _continued, ...kept} = previous;
  return {
    slides: slides.flatMap(entry =>
      entry.id === slide.id
        ? []
        : entry.id === previous.id
          ? [
              {
                ...withBox(kept, box, joined),
                ...(slide.continued === undefined ? {} : {continued: true}),
              },
            ]
          : [entry],
    ),
    caret: {id: previous.id, at: first.length},
  };
}

/** Puts a pasted text in a box; its blank rows start new slides. */
export function pasteSlideText(
  making: SlideMaking,
  slides: readonly Slide[],
  {id, box, start, end, pasted}: TextPlace & {readonly pasted: string},
): TextEdit | null {
  const slide = slides.find(entry => entry.id === id);
  if (slide === undefined) return null;
  const insertion = pasted.replace(/\r\n?/gu, '\n');
  const before = textOf(slide, box);
  const text = before.slice(0, start) + insertion + before.slice(end);
  const parts = text.split(BLANK_ROWS);
  if (
    slides.length + parts.length - 1 > SLIDE_LIMITS.slides ||
    parts.some(part => part.length > SLIDE_LIMITS.text)
  ) {
    return null;
  }
  const added = cutInto(making, slide, {box, parts});
  let focus = 0;
  let at = start + insertion.length;
  for (const match of text.matchAll(BLANK_ROWS)) {
    if (match.index > start + insertion.length) break;
    focus++;
    at = Math.max(0, start + insertion.length - match.index - match[0].length);
  }
  const target = added[focus];
  return target === undefined
    ? null
    : {
        slides: replaceSlide(slides, id, added),
        caret: {id: target.id, at},
      };
}
