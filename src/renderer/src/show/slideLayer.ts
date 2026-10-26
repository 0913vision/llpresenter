import type {SlideLayer} from '@shared/live';
import type {TileCursor} from './model';
import type {TilesOf} from './navigation';

/**
 * The 장 layer that outputting a tile sends, or null when the tile is missing.
 * It carries the item's next tile for the 무대 화면, and none after the last.
 */
export function slideLayerOf(
  cursor: TileCursor,
  tilesOf: TilesOf,
): SlideLayer | null {
  const tiles = tilesOf(cursor.itemId);
  const tile = tiles[cursor.index];
  if (!tile) return null;
  const next = tiles[cursor.index + 1];
  return {
    itemId: cursor.itemId,
    position: cursor.index,
    label: tile.label,
    lines: tile.lines,
    ...(next === undefined
      ? {}
      : {next: {label: next.label, lines: next.lines}}),
  };
}
