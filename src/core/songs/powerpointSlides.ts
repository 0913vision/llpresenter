import type {ImportSlide} from '../schema/textImport';

export interface PowerPointShape {
  readonly role: 'title' | 'body' | 'free';
  readonly lines: readonly string[];
  /** The one row that is written larger than the others. */
  readonly main?: number;
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

/** The rows of a title with its name first, and how many rows the name has. */
function nameFirst({lines, main}: PowerPointShape): {
  readonly name: readonly string[];
  readonly rest: readonly string[];
} {
  const own = main === undefined ? undefined : lines[main];
  return own === undefined
    ? {name: lines, rest: []}
    : {name: [own], rest: lines.filter((_, index) => index !== main)};
}

/** The song title a slide shows, or null when it shows lyrics. */
function titleOf(
  shapes: readonly PowerPointShape[],
  {
    starts,
    known,
  }: {readonly starts: boolean; readonly known: string | undefined},
): ImportSlide | null {
  if (shapes.some(shape => shape.role === 'body')) return null;
  const rows = rowsOf(shapes);
  if (rows.length === 0 || rows.length > TITLE_ROWS) return null;
  const named = shapes.find(shape => shape.role === 'title');
  const main = named ?? shapes[0];
  if (main === undefined) return null;
  const {name, rest} = nameFirst(main);
  if (!starts && named === undefined && name[0] !== known) return null;
  const others = shapes.filter(shape => shape !== main);
  return {
    titleSlide: true,
    lines: [...name, ...rest, ...rowsOf(others)],
    ...(name.length > 1 ? {titleLineCount: name.length} : {}),
  };
}

/** The slides where a song starts: the first with text on a new background. */
function songStarts(slides: readonly PowerPointSlide[]): ReadonlySet<number> {
  const starts = new Set<number>();
  const seen = new Set<string>();
  let waiting = true;
  slides.forEach(({background, shapes}, index) => {
    if (!seen.has(background)) {
      seen.add(background);
      waiting ||= runFrom(slides, index) >= SONG_SLIDES;
    }
    if (!waiting || shapes.length === 0) return;
    starts.add(index);
    waiting = false;
  });
  return starts;
}

/** A background that fewer slides in a row have is not one of a song. */
const SONG_SLIDES = 3;

function runFrom(slides: readonly PowerPointSlide[], start: number): number {
  const end = slides.findIndex(
    (slide, index) =>
      index > start && slide.background !== slides[start]?.background,
  );
  return (end < 0 ? slides.length : end) - start;
}

/**
 * The slides of a presentation as the slides of songs. A short slide without
 * a body is a song title when a song starts with it, when it has a title of
 * its own, or when it shows the title of the song again; every other text is
 * lyrics.
 */
export function powerpointSlides(
  slides: readonly PowerPointSlide[],
): readonly ImportSlide[] {
  const starts = songStarts(slides);
  let known: string | undefined;
  return slides.map(({shapes}, index) => {
    const rows = rowsOf(shapes);
    if (rows.length === 0) return {lines: []};
    const title = titleOf(shapes, {starts: starts.has(index), known});
    if (title !== null) {
      if (starts.has(index)) [known] = title.lines;
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
