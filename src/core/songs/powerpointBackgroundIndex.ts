/** Selects the first slide with the most common non-empty background key. */
export function powerpointBackgroundIndex(
  slides: ReadonlyArray<{readonly background: string | null}>,
): number | undefined {
  const counts = new Map<string, {count: number; index: number}>();
  slides.forEach((slide, index) => {
    if (!slide.background) return;
    const previous = counts.get(slide.background);
    counts.set(slide.background, {
      count: (previous?.count ?? 0) + 1,
      index: previous?.index ?? index,
    });
  });
  let winner: {count: number; index: number} | undefined;
  for (const candidate of counts.values()) {
    if (!winner || candidate.count > winner.count) winner = candidate;
  }
  return winner?.index;
}
