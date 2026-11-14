import type {SongLyricFormat} from '../schema/songLyricFormat';

export interface PowerPointShape {
  readonly body: boolean;
  readonly lines: readonly string[];
  readonly lyricFormat?: SongLyricFormat;
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
    if (body.length > 0) {
      const selected = slide.shapes.filter(shape => shape.body);
      const formats = selected.flatMap(shape => shape.lyricFormat?.lines ?? []);
      return {
        lines: body,
        ...(formats.length === body.length
          ? {lyricFormat: {lines: formats}}
          : {}),
      };
    }
    if (first || (firstTitle !== undefined && all[0] === firstTitle)) {
      const selected = slide.shapes.slice(0, 2);
      const title = selected.flatMap(shape => shape.lines);
      const formats = selected.flatMap(shape => shape.lyricFormat?.lines ?? []);
      if (first) firstTitle = all[0];
      return {
        titleSlide: true as const,
        lines: title,
        ...(formats.length === title.length &&
        formats.every(
          (line, i) => line.runs.map(run => run.text).join('') === title[i],
        )
          ? {lyricFormat: {lines: formats}}
          : {}),
      };
    }
    const formats = slide.shapes.flatMap(
      shape => shape.lyricFormat?.lines ?? [],
    );
    return {
      lines: all,
      ...(formats.length === all.length ? {lyricFormat: {lines: formats}} : {}),
    };
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
