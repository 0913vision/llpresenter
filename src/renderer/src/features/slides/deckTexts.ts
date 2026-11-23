import {
  filledText,
  NEXT_BOX,
  ownText,
  withOwnText,
  changeSlides,
  splitSlide,
  type TextEdit,
} from '@core/slides';
import type {ShowTile} from '@core/schema/showService';
import type {ThemeFile} from '@core/schema/theme';
import {slideMaking} from '@renderer/platform/themes';
import {focusText} from './deckSelection';
import type {SlideDeck} from './slideDeck';

/** Applies an edit of the texts and puts the caret where it goes on. */
export function applyTextEdit(
  deck: SlideDeck,
  box: string,
  change: TextEdit | null,
): boolean {
  if (change === null || deck.readOnly) return false;
  deck.edit(() => change.slides);
  focusText(deck.id, {...change.caret, box});
  return true;
}

/** Splits the slide whose text has the caret, where the caret is. */
export function splitAtCaret(
  deck: SlideDeck,
  input: HTMLTextAreaElement,
): boolean {
  const {slideField, slideBox} = input.dataset;
  const slide = deck.slides.find(entry => entry.id === slideField);
  if (slide === undefined || slideBox === undefined || slideBox === NEXT_BOX) {
    return false;
  }
  return applyTextEdit(
    deck,
    slideBox,
    splitSlide(slideMaking(), deck.slides, {
      id: slide.id,
      box: slideBox,
      start: input.selectionStart,
      end: input.selectionEnd,
    }),
  );
}

/** Gives a slide a text of its own for a box, or the one that fills it. */
export function setOwnText(
  deck: SlideDeck,
  {tile, theme, box}: {tile: ShowTile; theme: ThemeFile; box: string},
  own: boolean,
): void {
  const {slide} = tile;
  const text = own ? filledText(theme, tile, box) : '';
  if (ownText(slide, box) === text) return;
  deck.edit(slides =>
    changeSlides(slides, new Set([slide.id]), entry =>
      withOwnText(entry, box, text),
    ),
  );
}
