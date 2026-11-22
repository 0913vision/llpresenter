import type {Slide} from '@core/schema/slide';
import {changeSlides} from '@core/slides/edits';
import {selectionOf} from '../deckSelection';
import type {SlideDeck} from '../slideDeck';

/** Changes every selected slide of a deck. */
export function changeSelected(
  deck: SlideDeck,
  change: (slide: Slide) => Slide,
): void {
  const {ids} = selectionOf(deck);
  deck.edit(slides => changeSlides(slides, ids, change));
}

/** The slides a property row is about. */
export interface ChosenSlides {
  readonly deck: SlideDeck;
  readonly chosen: readonly Slide[];
}
