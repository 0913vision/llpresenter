import type {ShowView} from '@renderer/state/showStore';
import type {ShowTile} from '@core/schema/showService';

const NO_TILES: readonly ShowTile[] = [];

/** Rejects an old projection while either selected item or service is changing. */
export function savedPassageTiles(
  view: Pick<ShowView, 'serviceId' | 'openItemId' | 'tiles'>,
  serviceId: string | undefined,
  itemId: string | undefined,
): readonly ShowTile[] {
  return itemId !== undefined &&
    view.serviceId === serviceId &&
    view.openItemId === itemId
    ? (view.tiles[itemId] ?? NO_TILES)
    : NO_TILES;
}
