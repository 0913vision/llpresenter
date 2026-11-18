import type {ShowView} from '@renderer/session/showStore';
import type {ShowTile} from '@core/schema/showService';
import {isItemOfKind, type ServiceItemOf} from '@core/schema/service';
import {bibleEditorSlides} from './cardSlideModel';

const NO_TILES: readonly ShowTile[] = [];

/** Rejects an old projection while either selected item or service is changing. */
export function savedPassageTiles(
  view: Pick<ShowView, 'serviceId' | 'openItemId' | 'tiles'>,
  serviceId: string | undefined,
  itemId: string | undefined,
): readonly ShowTile[] {
  return view.openItemId === itemId
    ? savedItemTiles(view, serviceId, itemId)
    : NO_TILES;
}

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

/** Editor data retains the saved reference and uses measured verses when available. */
export function bibleEditorData(
  item: ServiceItemOf<'bible' | 'sermon'>,
  saved: readonly ShowTile[],
  measured?: readonly ShowTile[],
) {
  return {
    reference: isItemOfKind(item, 'sermon') ? item.sermon.passage : item.bible,
    slides: bibleEditorSlides(item.sectionCard, measured ?? saved),
  };
}
