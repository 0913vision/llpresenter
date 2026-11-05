import {
  boundaryPenalty,
  PENALTY_CLAUSE,
  tokenize,
  type Token,
} from './boundary';
import {layoutText, type SplitLayout} from './layout';

export const normalizeVerse = (text: string): string =>
  text.trim().replace(/\s+/g, ' ');
export const wordsOf = (text: string): readonly Token[] =>
  tokenize(normalizeVerse(text));
export const normalizeCuts = (
  cuts: readonly number[],
  wordCount: number,
): readonly number[] =>
  [...new Set(cuts)]
    .filter(j => Number.isInteger(j) && j >= 1 && j < wordCount)
    .sort((a, b) => a - b);

type PlanLayout = SplitLayout & {readonly prefix?: string};

class CutPlanner {
  readonly words: readonly Token[];
  constructor(
    private readonly text: string,
    private readonly layout: PlanLayout,
  ) {
    this.words = tokenize(text);
  }

  private slice(i: number, j: number): string {
    return this.text.slice(
      this.words[i]?.start ?? 0,
      this.words[j - 1]?.end ?? 0,
    );
  }

  private measure(i: number, j: number, withMarker: boolean) {
    const body = this.slice(i, j);
    return layoutText(
      i === 0 ? (this.layout.prefix ?? '') + body : body,
      this.layout,
      withMarker,
    );
  }

  private reachFrom(i: number, limit: number): number {
    let best = i;
    for (let j = i + 1; j <= limit; j++) {
      const isVerseEnd = j === this.words.length;
      if (this.measure(i, j, !isVerseEnd).fits) best = j;
      else if (!isVerseEnd) break;
    }
    return best;
  }

  private piecesNeeded(start: number, end: number): number {
    let count = 0;
    let at = start;
    while (at < end) {
      const next = this.reachFrom(at, end);
      at = next > at ? next : at + 1;
      count++;
    }
    return count;
  }

  plan(rawCuts: readonly number[]) {
    const cuts = normalizeCuts(rawCuts, this.words.length);
    const bounds = [0, ...cuts, this.words.length];
    const slides = bounds.slice(0, -1).map((start, index) => {
      const end = bounds[index + 1] ?? this.words.length;
      const isLast = end === this.words.length;
      const result = this.measure(start, end, !isLast);
      const reach = result.fits ? end : this.reachFrom(start, end);
      const problem = result.fits
        ? null
        : {
            spillAt: reach > start && reach < end ? reach : null,
            byMarker: !isLast && this.measure(start, end, false).fits,
            extraNeeded: Math.max(1, this.piecesNeeded(start, end) - 1),
          };
      return {
        index,
        start,
        end,
        isLast,
        text: this.slice(start, end),
        lines: result.lines,
        nLines: result.nLines,
        maxLines: this.layout.spec.maxLines,
        fits: result.fits,
        problem,
      };
    });
    return {
      text: this.text,
      words: this.words,
      cuts,
      slides,
      ok: slides.every(slide => slide.fits),
      slideCount: slides.length,
      extraNeeded: slides.reduce(
        (sum, slide) => sum + (slide.problem?.extraNeeded ?? 0),
        0,
      ),
    };
  }
}

/** Cut j is before word j. Prefix is measured on the first part only. */
export function planSlides(
  rawText: string,
  rawCuts: readonly number[],
  layout: PlanLayout,
) {
  return new CutPlanner(normalizeVerse(rawText), layout).plan(rawCuts);
}

export function goodBoundaries(words: readonly Token[]): readonly number[] {
  return words.flatMap((word, j) => {
    const previous = words[j - 1];
    return previous !== undefined &&
      boundaryPenalty(previous.text, word.text) <= PENALTY_CLAUSE
      ? [j]
      : [];
  });
}

export function cutsFromChunks(
  chunks: ReadonlyArray<{readonly text: string}>,
): readonly number[] {
  let at = 0;
  return chunks.slice(0, -1).map(chunk => {
    at += tokenize(chunk.text).length;
    return at;
  });
}
