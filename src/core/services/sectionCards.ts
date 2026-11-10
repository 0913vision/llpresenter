import type {ServiceItemId} from '../schema/ids';
import {
  isItemOfKind,
  type SectionCard,
  type ServiceItem,
  type ServiceItemOf,
} from '../schema/service';
import type {ShowTile} from '../schema/showService';
import {SECTION_THEME_ID, type SundaySection} from '../themes/sundaySections';

export function newSectionCard(): SectionCard {
  return {name: '구역 이름', english: '', theme: SECTION_THEME_ID};
}

export function canHaveSectionCard(
  item: ServiceItem,
): item is ServiceItemOf<'song' | 'slides' | 'bible'> {
  return (
    isItemOfKind(item, 'song') ||
    isItemOfKind(item, 'slides') ||
    isItemOfKind(item, 'bible')
  );
}

export function hasSectionCard(item: ServiceItem): item is ServiceItemOf<
  'song' | 'slides' | 'bible'
> & {
  readonly sectionCard: SectionCard;
} {
  return canHaveSectionCard(item) && item.sectionCard !== undefined;
}

/** The editable card shared by the item menu and built-in service templates. */
export function newSectionItem(
  id: ServiceItemId,
  section: SundaySection,
): ServiceItemOf<'slides'> {
  return {
    id,
    sectionCard: sectionCardOf(section),
    slides: {
      form: 'blank',
      name: section.name,
      slides: [],
    },
  };
}

/** A service-local opening card; the content keeps its own theme. */
export function sectionCardOf(section: SundaySection) {
  return {name: section.name, english: section.english, theme: section.theme};
}

const projectedCards = new WeakMap<
  readonly ShowTile[],
  WeakMap<SectionCard, readonly ShowTile[]>
>();

/** Prepend or refresh a published card, keeping a stable projection identity. */
export function withSectionCard(
  card: SectionCard | undefined,
  tiles: readonly ShowTile[],
): readonly ShowTile[] {
  if (card === undefined) return tiles;
  let cards = projectedCards.get(tiles);
  if (cards === undefined) {
    cards = new WeakMap();
    projectedCards.set(tiles, cards);
  }
  const cached = cards.get(card);
  if (cached !== undefined) return cached;
  const projected: readonly ShowTile[] = [
    {
      label: card.name,
      labelColor: 'none',
      lines: [card.english],
      sectionCard: card,
    },
    ...tiles.slice(tiles[0]?.sectionCard === undefined ? 0 : 1),
  ];
  cards.set(card, projected);
  return projected;
}

/** A service item carries the card data; live output carries its bounded offset. */
interface CardOffsetItem {
  readonly sectionCard?: SectionCard | undefined;
}
interface CardOffsetLive {
  readonly cardOffset?: 1 | undefined;
}

/** Number of opening cards before content positions. */
export function cardOffset(item: CardOffsetItem | CardOffsetLive): 0 | 1 {
  const source: CardOffsetItem & CardOffsetLive = item;
  return source.sectionCard !== undefined || source.cardOffset !== undefined
    ? 1
    : 0;
}
