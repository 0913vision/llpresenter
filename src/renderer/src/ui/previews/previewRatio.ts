/** The share of its column the 미리보기 takes until the operator drags it. */
export const DEFAULT_PREVIEW_RATIO = 0.667;

/** Keeps old and newly saved splits inside the supported range. */
export function clampPreviewRatio(value: number): number {
  return Number.isFinite(value)
    ? Math.max(0.15, Math.min(0.85, value))
    : DEFAULT_PREVIEW_RATIO;
}

/**
 * The largest split a frame can show when its rows share `space` pixels and
 * a small tile is at least `smallest` high. Past it the small tiles keep their
 * least height, so a larger ratio would only leave the divider behind the
 * pointer.
 */
export function largestShownRatio(space: number, smallest: number): number {
  return space > 0 ? clampPreviewRatio(1 - smallest / space) : 0.15;
}
