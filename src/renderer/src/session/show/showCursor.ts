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
