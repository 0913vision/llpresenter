import {thumbnailWidth} from '@renderer/ui/thumbnailSize';

/** Fixed tile width and actual track count for the details panel. */
export function detailsGridGeometry(width: number, gap: number, scale: number) {
  const tileWidth = thumbnailWidth({
    gridWidth: width,
    columns: 2,
    gap,
    scalePercent: scale,
  });
  return {
    tileWidth,
    columns:
      tileWidth > 0
        ? Math.max(1, Math.floor((width + gap) / (tileWidth + gap)))
        : 2,
  };
}
