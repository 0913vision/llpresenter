import type {SlideLayer} from '@shared/live';
import type {TileCursor} from './model';
import type {TilesOf} from './navigation';

/** The 장 layer that outputting a tile sends, or null when the tile is missing. */
export function slideLayerOf(
  cursor: TileCursor,
  tilesOf: TilesOf,
): SlideLayer | null {
  const tile = tilesOf(cursor.itemId)[cursor.index];
  if (!tile) return null;
  return {
    itemId: cursor.itemId,
    position: cursor.index,
    label: tile.label,
    lines: tile.lines,
  };
}
