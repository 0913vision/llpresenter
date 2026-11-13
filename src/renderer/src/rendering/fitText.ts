const MIN_FONT_SIZE = 1;
const LAYOUT_TOLERANCE_PX = 1;

/** Keeps the theme size unless wrapped text exceeds the actual element frame. */
export function fitTextInFrame(
  frame: {
    readonly size: number;
    readonly width: number;
    readonly height: number;
  },
  measure: (size: number) => {readonly width: number; readonly height: number},
): number {
  const height = frame.height + LAYOUT_TOLERANCE_PX;
  const width = frame.width + LAYOUT_TOLERANCE_PX;
  return fitFontSize(frame.size, candidate => {
    const measured = measure(candidate);
    return measured.width <= width && measured.height <= height;
  });
}

/**
 * Finds the largest whole-pixel font size, at most `size`, at which the text
 * fits. A 장 is never split, so the font keeps shrinking until every line fits
 * (docs/spec/03-output.md, drawing text).
 *
 * @param fits - Lays the text out at a size and tells whether it fits.
 */
export function fitFontSize(
  size: number,
  fits: (size: number) => boolean,
): number {
  const bounded = Number.isNaN(size)
    ? MIN_FONT_SIZE
    : Math.min(size, Number.MAX_SAFE_INTEGER);
  const maximum = Math.max(MIN_FONT_SIZE, Math.floor(bounded));
  if (fits(maximum)) return maximum;
  let fitting = MIN_FONT_SIZE;
  if (!fits(fitting)) return fitting;
  let tooLarge = maximum;
  while (tooLarge - fitting > 1) {
    const middle = fitting + Math.floor((tooLarge - fitting) / 2);
    if (fits(middle)) fitting = middle;
    else tooLarge = middle;
  }
  return fitting;
}

/** Whether the laid-out line boxes fit a configured line count. */
export function fitsLineLimit(
  height: number,
  size: number,
  options: {lineHeight: number; limit: number | undefined},
): boolean {
  return (
    options.limit === undefined ||
    height <= size * options.lineHeight * options.limit + 1
  );
}
