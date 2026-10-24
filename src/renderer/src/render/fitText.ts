/** The smallest size a 장 shrinks to, as a share of its style size. */
export const MIN_FONT_SHARE = 0.25;

/**
 * Finds the largest whole-pixel font size, at most `size`, at which the text
 * fits. A 장 is never split, so text that fits at no size gets the smallest
 * size (docs/spec/03-output.md, drawing text).
 *
 * @param fits - Lays the text out at a size and tells whether it fits.
 */
export function fitFontSize(
  size: number,
  fits: (size: number) => boolean,
): number {
  if (fits(size)) return size;
  let fitting = Math.max(1, Math.floor(size * MIN_FONT_SHARE));
  if (!fits(fitting)) return fitting;
  let tooLarge = Math.ceil(size);
  while (tooLarge - fitting > 1) {
    const middle = Math.floor((fitting + tooLarge) / 2);
    if (fits(middle)) fitting = middle;
    else tooLarge = middle;
  }
  return fitting;
}
