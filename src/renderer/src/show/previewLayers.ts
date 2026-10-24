import type {SlideLayer, LiveLayers} from '@shared/live';
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

/**
 * The layers of the "next" preview: what the screen would show after the
 * next-장 key. Every layer stays as it is now, and only the lyrics change. With
 * no next 장 the lyrics are empty.
 */
export function layersWithNextSlide(
  live: LiveLayers,
  next: SlideLayer | null,
): LiveLayers {
  return {...live, slide: next};
}
