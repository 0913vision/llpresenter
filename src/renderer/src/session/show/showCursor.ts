import type {SlideTile, TileCursor, ItemId} from '@core/presentation';
import {useLive} from '../live';
import {projectedLiveCursor, tilesForView} from './showLibrary';
import {useShow} from './showStore';

/** The tiles of an item of the open service, a passage, or a song. */
export function tilesOf(itemId: ItemId): readonly SlideTile[] {
  return tilesForView(useShow.getState(), itemId);
}

/** The tile on output, taken from the live slide. */
export function liveCursor(): TileCursor | null {
  return projectedLiveCursor(
    useShow.getState(),
    useLive.getState().state?.layers.slide ?? null,
  );
}

/**
 * Where the live item stood before a clear. A clear empties the slide layer
 * but keeps the item and the position of the slide it showed, so the next and
 * previous keys go on from there instead of starting the item over.
 */
export function clearedCursor(): TileCursor | null {
  const live = useLive.getState().state;
  const item = live?.item;
  if (live?.layers.slide != null || item == null) return null;
  const index = item.slidePosition;
  if (index === undefined || index >= tilesOf(item.id).length) return null;
  return {itemId: item.id, index};
}
