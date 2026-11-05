import type {SlideLayer} from '../live/state';
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
    ...(tile.biblePart === undefined ? {} : {biblePart: tile.biblePart}),
    label: tile.kind === undefined ? tile.label : null,
    lines: tile.lines,
    ...(tile.name === undefined ? {} : {name: tile.name}),
    ...(tile.picture === undefined ? {} : {picture: tile.picture}),
    ...(tile.kind === undefined ? {} : {kind: tile.kind}),
    ...(tile.continued === undefined ? {} : {continued: tile.continued}),
    ...(tile.reference === undefined ? {} : {reference: tile.reference}),
    ...(next === undefined
      ? {}
      : {
          next: {
            label: next.kind === undefined ? next.label : null,
            lines: next.lines,
            ...(next.continued === undefined
              ? {}
              : {continued: next.continued}),
          },
        }),
  };
}
