const MIN_FONT_SIZE = 1;

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
  if (fits(size)) return size;
  let fitting = MIN_FONT_SIZE;
  if (!fits(fitting)) return fitting;
  let tooLarge = Math.ceil(size);
  while (tooLarge - fitting > 1) {
    const middle = Math.floor((fitting + tooLarge) / 2);
    if (fits(middle)) fitting = middle;
    else tooLarge = middle;
  }
  return fitting;
}
