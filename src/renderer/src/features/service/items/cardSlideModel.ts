import type {SectionCard} from '@core/schema/service';
import {withSectionCard} from '@core/services/sectionCards';
import type {ShowTile} from '@core/schema/showService';

/** The Bible editor uses the same first card as output; verse text is read-only. */
export function bibleEditorSlides(
  card: SectionCard | undefined,
  tiles: readonly ShowTile[],
) {
  const verses = tiles.filter(tile => tile.sectionCard === undefined);
  return withSectionCard(card, verses).map(tile => ({
    tile,
    kind:
      tile.sectionCard === undefined ? ('verse' as const) : ('card' as const),
    readOnly: tile.sectionCard === undefined,
  }));
}
