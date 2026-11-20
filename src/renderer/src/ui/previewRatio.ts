export const DEFAULT_PREVIEW_RATIO = 0.667;

/** Keeps old and newly saved splits inside the supported range. */
export function clampPreviewRatio(value: number): number {
  return Number.isFinite(value)
    ? Math.max(0.15, Math.min(0.85, value))
    : DEFAULT_PREVIEW_RATIO;
}
