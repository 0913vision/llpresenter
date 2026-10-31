export function fitTabIndices({
  widths,
  available,
  more,
  gap,
  selected,
}: {
  readonly widths: readonly number[];
  readonly available: number;
  readonly more: number;
  readonly gap: number;
  readonly selected: number;
}): readonly number[] {
  const all = widths.map((_, index) => index);
  const rowWidth = (indices: readonly number[]): number =>
    indices.reduce((sum, index) => sum + (widths[index] ?? 0), 0) +
    Math.max(0, indices.length - 1) * gap;
  if (all.length <= 1 || rowWidth(all) <= available) return all;
  const budget = available - more - gap;
  for (let count = all.length - 1; count > 0; count--) {
    const visible = all.slice(0, count);
    if (selected >= count && selected < all.length) {
      visible[count - 1] = selected;
    }
    if (rowWidth(visible) <= budget || count === 1) return visible;
  }
  return [];
}
