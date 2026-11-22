import type {ShowView} from '@renderer/session/showStore';
import type {ShowTile} from '@core/schema/showService';
import {isItemOfKind, type ServiceItemOf} from '@core/schema/service';
import {bibleEditorSlides} from './cardSlideModel';

const NO_TILES: readonly ShowTile[] = [];

/** Keeps a shown editor's tiles while another item is being requested. */
export function savedItemTiles(
  view: Pick<ShowView, 'serviceId' | 'tiles'>,
  serviceId: string | undefined,
  itemId: string | undefined,
): readonly ShowTile[] {
  return itemId !== undefined && view.serviceId === serviceId
    ? (view.tiles[itemId] ?? NO_TILES)
    : NO_TILES;
}

export function bibleEditorData(
  item: ServiceItemOf<'bible' | 'sermon'>,
  tiles: readonly ShowTile[],
) {
  return {
    reference: isItemOfKind(item, 'sermon') ? item.sermon.passage : item.bible,
    slides: bibleEditorSlides(item.sectionCard, tiles),
  };
}
