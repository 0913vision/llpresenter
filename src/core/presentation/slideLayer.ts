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
    ...(tile.kind === 'ad' && tile.picture === undefined
      ? {
          textSlideNumber: tiles
            .slice(0, cursor.index + 1)
            .filter(tile => tile.picture === undefined).length,
        }
      : {}),
    ...(tile.biblePart === undefined ? {} : {biblePart: tile.biblePart}),
    ...(tile.sourceSlideId === undefined
      ? {}
      : {sourceSlideId: tile.sourceSlideId}),
    label:
      tile.kind === undefined || tile.biblePart !== undefined
        ? tile.label
        : null,
    lines: tile.lines,
    ...(tile.transition === undefined ? {} : {transition: tile.transition}),
    ...(tile.name === undefined ? {} : {name: tile.name}),
    ...(tile.picture === undefined ? {} : {picture: tile.picture}),
    ...(tile.kind === undefined ? {} : {kind: tile.kind}),
    ...(tile.continued === undefined ? {} : {continued: tile.continued}),
    ...(tile.reference === undefined ? {} : {reference: tile.reference}),
    ...(next === undefined
      ? {}
      : {
          next: {
            label:
              next.kind === undefined || next.biblePart !== undefined
                ? next.label
                : null,
            lines: next.lines,
            ...(next.continued === undefined
              ? {}
              : {continued: next.continued}),
            ...(next.biblePart === undefined
              ? {}
              : {biblePart: next.biblePart}),
          },
        }),
  };
}
