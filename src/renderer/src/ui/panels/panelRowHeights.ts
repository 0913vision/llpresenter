/** Fits remembered panel heights without changing their stored preferences. */
export function fitRows({
  preferred,
  minimums,
  available,
  fill,
}: {
  readonly preferred: readonly number[];
  readonly minimums: readonly number[];
  readonly available: number;
  readonly fill: number;
}): number[] {
  const heights = preferred.map((height, index) =>
    Math.max(height, minimums[index] ?? 0),
  );
  const total = heights.reduce((sum, height) => sum + height, 0);
  let excess = total - available;
  if (excess <= 0) {
    heights[fill] = (heights[fill] ?? 0) - excess;
    return heights;
  }
  const order = [
    fill,
    ...heights.map((_, index) => index).filter(index => index !== fill),
  ];
  for (const index of order) {
    const height = heights[index] ?? 0;
    const removed = Math.min(excess, height - (minimums[index] ?? 0));
    heights[index] = height - removed;
    excess -= removed;
  }
  return heights;
}
