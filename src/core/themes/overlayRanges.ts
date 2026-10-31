/** Inclusive slide ranges may arrive in any order; this never reorders the item. */
export function overlayRangesOverlap(
  ranges: ReadonlyArray<{readonly from: number; readonly to: number}>,
): boolean {
  const ordered = [...ranges].sort((left, right) => left.from - right.from);
  return ordered.some((range, index) => {
    const previous = ordered[index - 1];
    return previous !== undefined && previous.to >= range.from;
  });
}
