/** The selected place clamped to an order, or `undefined` for an empty one. */
export function shownPosition(
  position: number,
  length: number,
): number | undefined {
  return length === 0 ? undefined : Math.min(position, length - 1);
}
