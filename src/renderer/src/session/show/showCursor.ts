import type {SlideTile, TileCursor, ItemId} from '@core/presentation';
import type {LiveState} from '@core/schema/live/live';
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

// NOTE(0913vision): Kept in the window rather than read from main's live item,
// because a picture or video from the 미디어 panel replaces that item and its
// slide position with the media.
/** The tile that was on output last, while an item stays live. */
let lastShown: TileCursor | null = null;

/**
 * Remembers the tile of the slide on output, and forgets it once no item is
 * live. The show's live subscription calls it on every live state.
 */
export function rememberShownTile(state: LiveState | null): void {
  const slide = state?.layers.slide ?? null;
  if (slide !== null) {
    lastShown = projectedLiveCursor(useShow.getState(), slide);
  } else if (state?.item == null) {
    lastShown = null;
  }
}

/**
 * Where the operator stands while no slide is on output but an item is live:
 * the slide that was on output last. A clear (가사, 모두, 검은 화면) and a
 * picture or video from the 미디어 panel both take the slide off output, so the
 * next and previous keys go on from there instead of starting the item over.
 */
export function lastShownCursor(): TileCursor | null {
  const live = useLive.getState().state;
  if (live?.layers.slide != null || live?.item == null) return null;
  if (lastShown === null) return null;
  return lastShown.index < tilesOf(lastShown.itemId).length ? lastShown : null;
}
