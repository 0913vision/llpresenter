import type {SlideId} from '@core/schema/ids';
import {SLIDE_LIMITS, type Slide} from '@core/schema/slide';
import {
  insertSlides,
  moveSlides,
  pasteSlides,
  removeSlides,
  slideInsertionIndex,
  slideAfter,
  slidesOfText,
} from '@core/slides';
import {slideMaking} from '@renderer/platform/themes';
import {NEWER_FILE_REASON} from '@renderer/platform/problemReasons';
import {
  selectAdded,
  selectedSlides,
  selectInDeck,
  selectionOf,
} from './deckSelection';
import {copySlides, slidesCopiedAs} from './slideClipboard';
import type {SlideDeck} from './slideDeck';

export const FULL_REASON = '슬라이드가 너무 많습니다.';
const NOTHING_SELECTED = '선택한 슬라이드가 없습니다.';

/** Why slides can't be added to a deck. */
export function addReason(deck: SlideDeck, count = 1): string | undefined {
  if (deck.readOnly) return NEWER_FILE_REASON;
  return deck.slides.length + count > SLIDE_LIMITS.slides
    ? FULL_REASON
    : undefined;
}

/** Why the selected slides can't be changed. */
export function selectionReason(deck: SlideDeck): string | undefined {
  if (deck.readOnly) return NEWER_FILE_REASON;
  return selectionOf(deck).ids.size === 0 ? NOTHING_SELECTED : undefined;
}

export function copyReason(deck: SlideDeck): string | undefined {
  return selectionOf(deck).ids.size === 0 ? NOTHING_SELECTED : undefined;
}

function insertionIndex(deck: SlideDeck): number {
  return slideInsertionIndex(
    deck.slides.map(slide => slide.id),
    selectionOf(deck),
  );
}

/** Puts slides in at a gap and selects them. */
export function addSlides(
  deck: SlideDeck,
  added: readonly Slide[],
  at = insertionIndex(deck),
): void {
  if (added.length === 0 || addReason(deck, added.length) !== undefined) return;
  const after = deck.slides[at - 1]?.id;
  deck.edit(slides => {
    const index =
      after === undefined
        ? Math.min(at, slides.length)
        : slides.findIndex(slide => slide.id === after) + 1;
    return insertSlides(slides, index, added);
  });
  selectAdded(
    deck.id,
    added.map(slide => slide.id),
  );
}

/** Adds a slide after the selected one, in the theme that follows it. */
export function addSlide(deck: SlideDeck, at = insertionIndex(deck)): Slide {
  const slide = slideAfter(
    slideMaking(),
    deck.slides[at - 1],
    deck.source.kind,
  );
  addSlides(deck, [slide], at);
  return slide;
}

export function duplicateSelected(deck: SlideDeck): void {
  const chosen = selectedSlides(deck, selectionOf(deck));
  const last = chosen.at(-1);
  if (last === undefined) return;
  const {added} = pasteSlides([], 0, chosen);
  addSlides(
    deck,
    added,
    deck.slides.findIndex(slide => slide.id === last.id) + 1,
  );
}

export function copySelected(deck: SlideDeck): string | null {
  const chosen = selectedSlides(deck, selectionOf(deck));
  return chosen.length === 0 ? null : copySlides(chosen);
}

export function deleteSelected(deck: SlideDeck): void {
  const {ids} = selectionOf(deck);
  if (ids.size === 0 || deck.readOnly) return;
  const last = deck.slides.findLastIndex(slide => ids.has(slide.id));
  const next =
    deck.slides.slice(last + 1).find(slide => !ids.has(slide.id)) ??
    deck.slides.findLast(slide => !ids.has(slide.id));
  deck.edit(slides => removeSlides(slides, ids));
  if (next === undefined) selectInDeck(deck, {type: 'clear'});
  else selectInDeck(deck, {type: 'click', id: next.id});
}

/** Puts in what a copied text stands for: the slides, or new ones of it. */
export function pasteInto(deck: SlideDeck, text: string): void {
  const own = slidesCopiedAs(text);
  const at = insertionIndex(deck);
  const added =
    own === undefined
      ? slidesOfText(slideMaking(), text, {
          before: deck.slides[at - 1],
          kind: deck.source.kind,
        })
      : pasteSlides([], 0, own).added;
  addSlides(deck, added, at);
}

/** Moves the selected slides to a gap of the list. */
export function moveSelected(deck: SlideDeck, gap: number): void {
  const {ids} = selectionOf(deck);
  const before = deck.slides.slice(gap).find(slide => !ids.has(slide.id))?.id;
  deck.edit(slides =>
    moveSlides(
      slides,
      ids,
      before === undefined
        ? slides.length
        : slides.findIndex(slide => slide.id === before),
    ),
  );
  selectAdded(
    deck.id,
    deck.slides.flatMap(slide => (ids.has(slide.id) ? [slide.id] : [])),
  );
}

/** The slides an edit of the selection changes. */
export function selectedIds(deck: SlideDeck): ReadonlySet<SlideId> {
  return selectionOf(deck).ids;
}
