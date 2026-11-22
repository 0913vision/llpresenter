import type {SlideLayer} from '@core/live/state';
import type {TileCursor} from '@core/presentation/model';
import {projectedLiveCursor, tilesForView} from './showLibrary';
import type {ShowView} from './showStore';

/** What came after the live slide while its item still had it. */
interface Anchor {
  readonly slideId: string;
  readonly itemId: string;
  readonly successors: readonly string[];
  readonly followingItems: readonly string[];
}

let anchor: Anchor | null = null;

/** Remembers what comes after the live slide, for when it is deleted. */
export function rememberLiveAnchor(
  view: ShowView,
  slide: SlideLayer | null,
): void {
  const cursor = projectedLiveCursor(view, slide);
  if (slide === null) anchor = null;
  if (slide === null || cursor === null) return;
  const at = view.rows.findIndex(row => row.id === slide.itemId);
  anchor = {
    slideId: slide.slideId,
    itemId: slide.itemId,
    successors: tilesForView(view, slide.itemId)
      .slice(cursor.index + 1)
      .map(tile => tile.slide.id),
    followingItems: at < 0 ? [] : view.rows.slice(at + 1).map(row => row.id),
  };
}

/** Where a live slide that was deleted goes on, or null for nowhere. */
export function liveSuccessor(
  view: ShowView,
  slide: SlideLayer,
): TileCursor | null {
  if (anchor?.slideId !== slide.slideId) return null;
  const {itemId, successors, followingItems} = anchor;
  const tiles = tilesForView(view, itemId);
  for (const id of successors) {
    const index = tiles.findIndex(tile => tile.slide.id === id);
    if (index >= 0) return {itemId, index};
  }
  const next = followingItems.find(
    id =>
      view.rows.some(row => row.id === id && row.kind !== 'header') &&
      tilesForView(view, id).length > 0,
  );
  return next === undefined ? null : {itemId: next, index: 0};
}
