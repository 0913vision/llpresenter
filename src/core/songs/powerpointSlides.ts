export interface PowerPointShape {
  readonly body: boolean;
  readonly lines: readonly string[];
}
export interface PowerPointSlide {
  readonly number: number;
  readonly shapes: readonly PowerPointShape[];
  readonly background: string | null;
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
