import {
  filledText,
  ownText,
  withOwnText,
  changeSlides,
} from '@core/slides';
import type {ShowTile} from '@core/schema/services/showService';
import type {ThemeFile} from '@core/schema/screens/theme';
import type {SlideDeck} from '../slideDeck';

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
