import {createSlideId, type ServiceItemId} from '../schema/ids';
import type {SectionCard, ServiceItemOf} from '../schema/service';
import type {ShowTile} from '../schema/showService';
import {type SundaySection} from '../themes/sundaySections';

/** The editable card shared by the item menu and built-in service templates. */
export function newSectionItem(
  id: ServiceItemId,
  section: SundaySection,
): ServiceItemOf<'slides'> {
  return {
    id,
    theme: section.theme,
    slides: {
      form: 'blank',
      name: section.name,
      slides: [{id: createSlideId(crypto.randomUUID()), text: section.english}],
    },
  };
}

/** A service-local opening card; the content keeps its own theme. */
export function sectionCardOf(section: SundaySection) {
  return {name: section.name, english: section.english, theme: section.theme};
}

/** Prepend a card, replacing one already present in a published projection. */
export function withSectionCard(
  card: SectionCard | undefined,
  tiles: readonly ShowTile[],
): readonly ShowTile[] {
  return card === undefined
    ? tiles
    : [
        {
          label: card.name,
          labelColor: 'none',
          lines: [card.english],
          sectionCard: card,
        },
        ...tiles.slice(tiles[0]?.sectionCard === undefined ? 0 : 1),
      ];
}

/** Number of opening cards before content positions. */
export function cardOffset(item: {
  readonly sectionCard?: unknown;
  readonly cardOffset?: 1;
}): 0 | 1 {
  return item.sectionCard !== undefined || item.cardOffset === 1 ? 1 : 0;
}
