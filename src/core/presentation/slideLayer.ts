import type {NextSlide, SlideLayer} from '../live/state';
import type {SlideTile, TileCursor} from './model';
import type {TilesOf} from './navigation';

/** Projects a tile into the live stage preview payload. */
export function nextSlideOf(
  tile: SlideTile,
  kind?: NextSlide['itemKind'],
  fallbackTitle?: string,
): NextSlide {
  const title =
    tile.sectionCard?.name ??
    tile.name ??
    (tile.media !== undefined || tile.picture !== undefined
      ? fallbackTitle
      : undefined);
  return {
    label:
      tile.kind === undefined || tile.biblePart !== undefined
        ? tile.label
        : null,
    lines: tile.lines,
    ...(kind === undefined ? {} : {itemKind: kind}),
    ...(title === undefined || title.trim() === '' ? {} : {title}),
    ...(tile.continued === undefined ? {} : {continued: tile.continued}),
    ...(tile.biblePart === undefined ? {} : {biblePart: tile.biblePart}),
  };
}

/**
 * The 장 layer that outputting a tile sends, or null when the tile is missing.
 * It carries the item's next tile for the 무대 화면, and none after the last.
 */
export function slideLayerOf(
  cursor: TileCursor,
  tilesOf: TilesOf,
  following?: {
    readonly tile: SlideTile;
    readonly kind: 'song' | 'bible' | 'blank' | 'ad' | 'media';
    readonly title?: string;
  },
): SlideLayer | null {
  const tiles = tilesOf(cursor.itemId);
  const tile = tiles[cursor.index];
  if (!tile) return null;
  const next = tiles[cursor.index + 1] ?? following?.tile;
  return {
    itemId: cursor.itemId,
    position: cursor.index,
    sequenceLength: tiles.length,
    ...(tile.kind === 'ad' && tile.picture === undefined
      ? {
          textSlideNumber: tiles
            .slice(0, cursor.index + 1)
            .filter(tile => tile.kind === 'ad' && tile.picture === undefined)
            .length,
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
    ...(tile.sectionCard === undefined ? {} : {sectionCard: tile.sectionCard}),
    ...(tile.titleSlide === undefined ? {} : {titleSlide: tile.titleSlide}),
    ...(tile.titleLayout === undefined ? {} : {titleLayout: tile.titleLayout}),
    ...(tile.transition === undefined ? {} : {transition: tile.transition}),
    ...(tile.name === undefined ? {} : {name: tile.name}),
    ...(tile.picture === undefined ? {} : {picture: tile.picture}),
    ...(tile.kind === undefined ? {} : {kind: tile.kind}),
    ...(tile.continued === undefined ? {} : {continued: tile.continued}),
    ...(tile.reference === undefined ? {} : {reference: tile.reference}),
    ...(next === undefined
      ? {}
      : {
          next: nextSlideOf(
            next,
            tiles[cursor.index + 1] === undefined ? following?.kind : undefined,
            following?.title,
          ),
        }),
  };
}
