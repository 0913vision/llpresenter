export const MIN_THUMBNAIL_SCALE_PERCENT = 50;
export const MAX_THUMBNAIL_SCALE_PERCENT = 200;
export const DEFAULT_THUMBNAIL_SCALE_PERCENT = 100;
export const THUMBNAIL_SCALE_STEP = 1;
export const THUMBNAIL_SCALE_SHIFT_STEP = 10;

/** Keeps a live thumbnail percentage in the spec-13 range, including fractions. */
export function clampThumbnailScale(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_THUMBNAIL_SCALE_PERCENT;
  return Math.min(
    MAX_THUMBNAIL_SCALE_PERCENT,
    Math.max(MIN_THUMBNAIL_SCALE_PERCENT, value),
  );
}

/** The whole percentage persisted after a drag or committed field edit. */
export function commitThumbnailScale(value: number): number {
  return (
    Math.round(clampThumbnailScale(value) / THUMBNAIL_SCALE_STEP) *
    THUMBNAIL_SCALE_STEP
  );
}

export interface ThumbnailGeometry {
  readonly gridWidth: number;
  /** Default columns at 100%, normally 3, 4, or 6 for the size class. */
  readonly columns: number;
  /** The grid's horizontal design-token gap in CSS pixels. */
  readonly gap: number;
  readonly scalePercent: number;
}

/**
 * Fixed tile width from spec-13. Wrapping never stretches it to fill a row.
 * Returns zero until the caller has measured a positive grid width.
 */
export function thumbnailWidth({
  gridWidth,
  columns,
  gap,
  scalePercent,
}: ThumbnailGeometry): number {
  if (!Number.isFinite(gridWidth) || gridWidth <= 0) return 0;
  const count = Number.isFinite(columns) ? Math.max(1, Math.trunc(columns)) : 1;
  const gutter = Number.isFinite(gap) ? Math.max(0, gap) : 0;
  const baseline = Math.max(0, (gridWidth - (count - 1) * gutter) / count);
  return Math.min(
    gridWidth,
    (baseline * clampThumbnailScale(scalePercent)) /
      DEFAULT_THUMBNAIL_SCALE_PERCENT,
  );
}
