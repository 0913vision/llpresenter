import type {ImportSlide} from '../schema/textImport';

export interface PowerPointShape {
  readonly role: 'title' | 'body' | 'free';
  readonly lines: readonly string[];
}

export interface PowerPointSlide {
  readonly number: number;
  readonly shapes: readonly PowerPointShape[];
  /** Names what is behind the texts; the same for the same picture. */
  readonly background: string;
  /** The color of the text, as RGB. */
  readonly textColor: number | null;
}

/** A title says no more than this; a longer text is lyrics. */
const TITLE_ROWS = 4;

function rowsOf(shapes: readonly PowerPointShape[]): readonly string[] {
  return shapes.flatMap(shape => shape.lines);
}

/** The song title a slide shows, or null when it shows lyrics. */
function titleOf(
  shapes: readonly PowerPointShape[],
  {first, known}: {readonly first: boolean; readonly known: string | undefined},
): ImportSlide | null {
  if (shapes.some(shape => shape.role === 'body')) return null;
  const rows = rowsOf(shapes);
  if (rows.length === 0 || rows.length > TITLE_ROWS) return null;
  const named = shapes.find(shape => shape.role === 'title');
  if (!first && named === undefined && rows[0] !== known) return null;
  const main = named ?? shapes[0];
  const others = shapes.filter(shape => shape !== main);
  const titleLineCount = main?.lines.length ?? 0;
  return {
    titleSlide: true,
    lines: [...(main?.lines ?? []), ...rowsOf(others)],
    ...(titleLineCount > 1 ? {titleLineCount} : {}),
  };
}

/**
 * The slides of a presentation as the slides of a song. A short slide without
 * a body is a song title when it comes first, has a title of its own, or shows
 * the title that came first; every other text is lyrics.
 */
export function powerpointSlides(
  slides: readonly PowerPointSlide[],
): readonly ImportSlide[] {
  let known: string | undefined;
  let first = true;
  return slides.map(({shapes}) => {
    const rows = rowsOf(shapes);
    if (rows.length === 0) return {lines: []};
    const title = titleOf(shapes, {first, known});
    first = false;
    if (title !== null) {
      known ??= title.lines[0];
      return title;
    }
    const body = shapes.filter(shape => shape.role === 'body');
    return {lines: [...(body.length === 0 ? rows : rowsOf(body))]};
  });
}

function luminance(color: number): number {
  const linear = (value: number): number => {
    const channel = value / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * linear((color >> 16) & 255) +
    0.7152 * linear((color >> 8) & 255) +
    0.0722 * linear(color & 255)
  );
}

/** Whether most of the slides write in a dark color, on a bright background. */
export function powerpointDarkLyrics(
  slides: readonly PowerPointSlide[],
): boolean {
  const colors = slides.flatMap(({shapes, textColor}) =>
    textColor === null || shapes.length === 0 ? [] : [textColor],
  );
  const dark = colors.filter(color => luminance(color) < 0.5).length;
  return dark * 2 > colors.length;
}
