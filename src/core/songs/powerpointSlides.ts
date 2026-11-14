import {SONG_LIMITS} from '../schema/song';

export interface PowerPointShape {
  readonly body: boolean;
  readonly lines: readonly string[];
}
export interface PowerPointSlide {
  readonly number: number;
  readonly shapes: readonly PowerPointShape[];
  readonly background: string | null;
  readonly lyricColor?: number | null;
  readonly label?: string;
}

const SHORT_TITLE_LENGTH = 40;
const compact = (value: string): string =>
  value.normalize('NFC').replace(/\s/gu, '');

function contentOf(slide: PowerPointSlide): readonly string[] {
  const body = slide.shapes
    .filter(shape => shape.body)
    .flatMap(shape => shape.lines);
  return (
    body.length > 0 ? body : slide.shapes.flatMap(shape => shape.lines)
  ).filter(line => line.trim() !== '');
}

/** Converts a selected contiguous range into song slides. */
export function powerpointSlides(
  slides: readonly PowerPointSlide[],
  songName = '',
) {
  let firstText = false;
  let firstTitle: string | undefined;
  return slides.map((slide, index) => {
    const body = slide.shapes
      .filter(shape => shape.body)
      .flatMap(shape => shape.lines);
    const all = slide.shapes.flatMap(shape => shape.lines);
    const label = slide.label === undefined ? {} : {label: slide.label};
    if (!all.some(line => line.trim() !== '')) return {...label, lines: []};
    const first = !firstText;
    firstText = true;
    if (body.length > 0) {
      if (!first) return {...label, lines: body};
      const text = body.filter(line => line.trim() !== '');
      const name = compact(songName);
      const one = text.length === 1 ? compact(text[0] ?? '') : '';
      const next = slides
        .slice(index + 1)
        .map(contentOf)
        .find(lines => lines.length > 0);
      const nextLine = compact(next?.[0] ?? '');
      const matchesName = name !== '' && compact(text.join('')) === name;
      const standalone =
        one.length > 0 &&
        one.length <= SHORT_TITLE_LENGTH &&
        nextLine !== '' &&
        !nextLine.startsWith(one) &&
        !one.startsWith(nextLine);
      if (
        (matchesName || standalone) &&
        text.length <= 2 &&
        text.every(
          line => line.length <= SONG_LIMITS.titleLine && !/[\r\n]/.test(line),
        )
      ) {
        firstTitle = text[0];
        return {...label, titleSlide: true as const, lines: text};
      }
      return {...label, lines: body};
    }
    if (first || (firstTitle !== undefined && all[0] === firstTitle)) {
      const title = slide.shapes
        .slice(0, 2)
        .map(shape => shape.lines.join(' '));
      if (first) firstTitle = all[0];
      return {...label, titleSlide: true as const, lines: title};
    }
    return {...label, lines: all};
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
