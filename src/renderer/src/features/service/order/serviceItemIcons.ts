import type {ItemKind, ItemRow, SlideTile} from '@core/presentation/model';
import type {ServiceItemOf} from '@core/schema/service';

export const SERMON_ICON = 'mic';

/** Icons shared by the order table and its insertable item palette. */
export const iconByKind: Readonly<Record<ItemKind, string>> = {
  song: 'song',
  bible: 'book',
  media: 'film',
  slides: 'monitor',
  unknown: 'filex',
};

/** The source item is picture-only when every content slide is an image. */
export function slidesItemIcon(item: ServiceItemOf<'slides'>): string {
  const slides = item.slides.slides;
  return slides.length > 0 && slides.every(slide => 'media' in slide)
    ? 'image'
    : iconByKind.slides;
}

/** Projected order rows include optional section cards, which are not content. */
export function serviceRowIcon(
  row: ItemRow,
  tiles: readonly SlideTile[] | undefined,
): string {
  if (row.kind === 'bible' && row.sermonTitle !== undefined) return SERMON_ICON;
  if (row.kind !== 'slides') return iconByKind[row.kind];
  const content = tiles?.filter(tile => tile.sectionCard === undefined) ?? [];
  return content.length > 0 && content.every(tile => tile.picture !== undefined)
    ? 'image'
    : iconByKind.slides;
}
