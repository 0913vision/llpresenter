export interface PowerPointShape {
  readonly body: boolean;
  readonly lines: readonly string[];
}
export interface PowerPointSlide {
  readonly number: number;
  readonly shapes: readonly PowerPointShape[];
  readonly background: string | null;
  readonly lyricColor?: number | null;
}

/** Converts a selected contiguous range into song slides. */
export function powerpointSlides(slides: readonly PowerPointSlide[]) {
  let firstText = false;
  let firstTitle: string | undefined;
  return slides.map(slide => {
    const body = slide.shapes
      .filter(shape => shape.body)
      .flatMap(shape => shape.lines);
    const all = slide.shapes.flatMap(shape => shape.lines);
    if (all.length === 0) return {lines: []};
    const first = !firstText;
    firstText = true;
    if (body.length > 0) return {lines: body};
    if (first || (firstTitle !== undefined && all[0] === firstTitle)) {
      const title = slide.shapes
        .slice(0, 2)
        .map(shape => shape.lines.join(' '));
      if (first) firstTitle = all[0];
      return {titleSlide: true as const, lines: title};
    }
    return {lines: all};
  });
}

/** Chooses the most common resolved lyric color in the selected range. */
export function powerpointDarkLyrics(
  slides: readonly PowerPointSlide[],
): boolean {
  const votes = new Map<number, number>();
  for (const slide of slides) {
    if (!slide.shapes.some(shape => shape.body && shape.lines.length > 0)) {
      continue;
    }
    const value = slide.lyricColor;
    if (value === null || value === undefined) continue;
    votes.set(value, (votes.get(value) ?? 0) + 1);
  }
  let winner: number | undefined;
  let count = 0;
  for (const [value, votesForColor] of votes) {
    if (votesForColor > count) {
      winner = value;
      count = votesForColor;
    }
  }
  if (winner === undefined) {
    return false;
  }
  const linear = (value: number): number => {
    const channel = value / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  };
  const luminance =
    0.2126 * linear((winner >> 16) & 255) +
    0.7152 * linear((winner >> 8) & 255) +
    0.0722 * linear(winner & 255);
  return luminance < 0.5;
}
