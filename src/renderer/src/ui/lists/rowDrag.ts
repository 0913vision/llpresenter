/**
 * Whether a pointer at `y` drops before the row in `box` rather than after it.
 */
export function beforeRowMidpoint(
  y: number,
  box: Pick<DOMRect, 'top' | 'height'>,
): boolean {
  return y < box.top + box.height / 2;
}
