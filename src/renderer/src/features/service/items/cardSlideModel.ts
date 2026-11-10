import {type SectionCard, type ServiceItem} from '@core/schema/service';
import {canHaveSectionCard, withSectionCard} from '@core/services/sectionCards';
import type {ShowTile} from '@core/schema/showService';

/** Update the one service-local card shared by the editor and item details. */
export function setItemCard(
  item: ServiceItem,
  card: SectionCard | undefined,
): ServiceItem | null {
  if (!canHaveSectionCard(item)) {
    return null;
  }
  const updated = {...item};
  if (card === undefined) delete updated.sectionCard;
  else updated.sectionCard = card;
  return updated;
}

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
