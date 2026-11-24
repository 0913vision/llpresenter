import {clampThumbnailScale} from '@renderer/ui/choices/thumbnailSize';

const DEFAULT_TILE_WIDTH = 208;

/** Fixed tile width and actual track count for the details panel. */
export function detailsGridGeometry(width: number, gap: number, scale: number) {
  const tileWidth = (DEFAULT_TILE_WIDTH * clampThumbnailScale(scale)) / 100;
  return {
    tileWidth,
    columns: Math.max(1, Math.floor((width + gap) / (tileWidth + gap))),
  };
}
