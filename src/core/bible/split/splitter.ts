import {boundaryPenalty, penaltyLabel, tokenize, type Token} from './boundary';
import {BIBLE_LOOKUP_LIMITS} from '../../schema/bibleLookup';
import {
  CONT_MARKER,
  fillRatio,
  layoutText,
  type LayoutResult,
  type SplitLayout,
} from './layout';

export const FILL_WEIGHT = 90;
export const ACCEPTABLE_PENALTY_GAP = 25;
export const COST_TOLERANCE = 25;
export const MAX_CANDIDATES = 3;
export const SPLIT_LIMITS = {
  tokens: 1_296,
  tableCells: 1_000_000,
  measurements: 100_000,
} as const;

export interface SplitChunk {
  readonly index: number;
  readonly text: string;
  readonly display: string;
  readonly continued: boolean;
  readonly lines: readonly string[];
  readonly lineWidths: readonly number[];
  readonly nLines: number;
  readonly fillRatio: number;
  readonly boundaryRule: string;
  readonly chosenBy: 'fit' | 'forced' | 'rules' | 'llm';
}

export interface SplitCandidate {
  readonly tokenIndex: number;
  readonly text: string;
  readonly rulePenalty: number;
  readonly ruleLabel: string;
  readonly fillRatio: number;
  readonly totalCost: number;
}

export interface SplitResult {
  readonly chunks: readonly SplitChunk[];
  readonly nSlides: number;
  readonly minSlides: number;
}

/** One invocation owns its DP tables and measurements; nothing is cached across verses. */
class SplitSearch {
  private readonly cache = new Map<string, LayoutResult>();
  readonly tokens: readonly Token[];

  constructor(
    private readonly text: string,
    private readonly layout: SplitLayout,
    private readonly prefix: string,
  ) {
    this.tokens = this.expandTokens(tokenize(text));
  }

  private token(at: number): Token {
    const token = this.tokens[at];
    if (token === undefined) throw new Error('Invalid split token index');
    return token;
  }

  private expandTokens(tokens: readonly Token[]): readonly Token[] {
    const out: Token[] = [];
    for (const token of tokens) {
      this.checkTokenBudget(out.length);
      if (layoutText(token.text, this.layout, true).fits) {
        out.push(token);
        continue;
      }
      this.expandWord(token, out);
    }
    return out;
  }

  private checkTokenBudget(count: number): void {
    if (count >= SPLIT_LIMITS.tokens) {
      throw new Error('Bible split token limit exceeded');
    }
  }

  private expandWord(token: Token, out: Token[]): void {
    const ends: number[] = [];
    let offset = token.start;
    for (const character of token.text) {
      offset += character.length;
      ends.push(offset);
    }
    let start = token.start;
    let first = 0;
    while (first < ends.length) {
      this.checkTokenBudget(out.length);
      const index = this.largestPieceEnd(start, ends, first);
      const end = ends[index] ?? token.end;
      out.push({text: this.text.slice(start, end), start, end});
      start = end;
      first = index + 1;
    }
  }

  private largestPieceEnd(
    start: number,
    ends: readonly number[],
    first: number,
  ): number {
    const tokenEnd = ends.at(-1) ?? start;
    let low = first;
    let high = ends.length - 1;
    let best = first;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const end = ends[middle] ?? tokenEnd;
      if (
        layoutText(this.text.slice(start, end), this.layout, end < tokenEnd)
          .fits
      ) {
        best = middle;
        low = middle + 1;
      } else high = middle - 1;
    }
    return best;
  }

  slice(i: number, j: number): string {
    return this.text.slice(this.token(i).start, this.token(j - 1).end);
  }

  at(i: number, j: number): LayoutResult {
    const key = `${i}:${j}`;
    const hit = this.cache.get(key);
    if (hit !== undefined) return hit;
    const body = this.slice(i, j);
    const result = layoutText(
      i === 0 ? this.prefix + body : body,
      this.layout,
      j !== this.tokens.length,
    );
    this.cache.set(key, result);
    return result;
  }

  private reachFrom(i: number): readonly number[] {
    const n = this.tokens.length;
    const out: number[] = [];
    for (let j = i + 1; j < n; j++) {
      if (this.at(i, j).fits) out.push(j);
      else break;
    }
    if (this.at(i, n).fits) out.push(n);
    return out;
  }

  private chunkCost(i: number, j: number) {
    const penalty =
      j === this.tokens.length
        ? 0
        : boundaryPenalty(this.token(j - 1).text, this.token(j).text);
    const slack = 1 - fillRatio(this.at(i, j), this.layout.spec.maxLines);
    return {cost: penalty + FILL_WEIGHT * slack * slack, penalty};
  }

  solve(extraSlides: number) {
    const n = this.tokens.length;
    const reach = this.tokens.map((_, i) => this.reachFrom(i));
    const counts: number[] = Array.from({length: n + 1}, () => Infinity);
    counts[n] = 0;
    for (let i = n - 1; i >= 0; i--) {
      counts[i] =
        1 + Math.min(...(reach[i] ?? []).map(j => counts[j] ?? Infinity));
    }
    const minSlides = counts[0] ?? n;
    if (!Number.isFinite(minSlides)) {
      throw new Error('Bible verse cannot fit the configured layout');
    }
    const maxSlides = minSlides + extraSlides;
    if ((n + 1) * (maxSlides + 1) > SPLIT_LIMITS.tableCells) {
      throw new Error('Bible split table limit exceeded');
    }
    const cost: number[][] = Array.from({length: n + 1}, (_, i) =>
      Array.from({length: maxSlides + 1}, () => (i === n ? 0 : Infinity)),
    );
    for (let i = n - 1; i >= 0; i--) {
      const row = cost[i];
      if (row === undefined) continue;
      for (let s = 1; s <= maxSlides; s++) {
        for (const j of reach[i] ?? []) {
          const tail = cost[j]?.[s - 1] ?? Infinity;
          row[s] = Math.min(
            row[s] ?? Infinity,
            this.chunkCost(i, j).cost + tail,
          );
        }
      }
    }
    return {cost, reach, minSlides};
  }

  candidates(
    i: number,
    slidesLeft: number,
    solution: ReturnType<SplitSearch['solve']>,
  ): readonly SplitCandidate[] {
    const {cost, reach} = solution;
    const scored = (reach[i] ?? []).flatMap(j => {
      const tail = cost[j]?.[slidesLeft - 1] ?? Infinity;
      return tail === Infinity
        ? []
        : [{total: this.chunkCost(i, j).cost + tail, j}];
    });
    if (scored.length === 0) {
      throw new Error('No fitting Bible split candidate');
    }
    const optimum = cost[i]?.[slidesLeft] ?? Infinity;
    const near = scored.filter(
      value => value.total <= optimum + COST_TOLERANCE,
    );
    const candidates = (near.length > 0 ? near : scored).map(({total, j}) => ({
      tokenIndex: j,
      text: this.slice(i, j),
      rulePenalty: this.chunkCost(i, j).penalty,
      ruleLabel:
        j === this.tokens.length
          ? '끝'
          : penaltyLabel(this.chunkCost(i, j).penalty),
      fillRatio: fillRatio(this.at(i, j), this.layout.spec.maxLines),
      totalCost: total,
    }));
    const cheapest = candidates.reduce((a, b) =>
      a.totalCost <= b.totalCost ? a : b,
    );
    const bestPenalty = Math.min(...candidates.map(value => value.rulePenalty));
    const viable = candidates.filter(
      value => value.rulePenalty <= bestPenalty + ACCEPTABLE_PENALTY_GAP,
    );
    if (!viable.includes(cheapest)) viable.push(cheapest);
    return viable
      .sort((a, b) => a.totalCost - b.totalCost)
      .slice(0, MAX_CANDIDATES);
  }
}

export type BoundaryChooser = (
  fullText: string,
  remaining: string,
  candidates: readonly SplitCandidate[],
) => Promise<number>;

interface SplitChoice {
  readonly index: number;
  readonly by: 'rules' | 'llm';
}
interface SplitStep {
  readonly text: string;
  readonly remaining: string;
  readonly candidates: readonly SplitCandidate[];
}
interface SplitOptions {
  readonly prefix?: string;
  readonly extraSlides?: number;
}

function* splitSteps(
  rawText: string,
  sourceLayout: SplitLayout,
  options: SplitOptions,
): Generator<SplitStep, SplitResult, SplitChoice> {
  const text = rawText.trim().replace(/\s+/g, ' ');
  if (
    text.length > BIBLE_LOOKUP_LIMITS.verseText ||
    tokenize(text).length > SPLIT_LIMITS.tokens
  ) {
    throw new Error('Bible split input limit exceeded');
  }
  if (text === '') return {chunks: [], nSlides: 0, minSlides: 0};
  let measurements = 0;
  const layout: SplitLayout = {
    ...sourceLayout,
    measure: (body, spec) => {
      if (measurements >= SPLIT_LIMITS.measurements) {
        throw new Error('Bible split measurement limit exceeded');
      }
      measurements++;
      return sourceLayout.measure(body, spec);
    },
  };
  const prefix = options.prefix ?? '';
  const whole = layoutText(prefix + text, layout);
  const makeChunk = ({
    body,
    result,
    continued,
    index,
    boundaryRule,
    chosenBy,
  }: {
    readonly body: string;
    readonly result: LayoutResult;
    readonly continued: boolean;
    readonly index: number;
    readonly boundaryRule: string;
    readonly chosenBy: SplitChunk['chosenBy'];
  }): SplitChunk => ({
    index,
    text: body,
    display: body + (continued ? CONT_MARKER : ''),
    continued,
    lines: result.lines,
    lineWidths: result.lineWidths,
    nLines: result.nLines,
    fillRatio: fillRatio(result, layout.spec.maxLines),
    boundaryRule,
    chosenBy,
  });
  if (whole.fits) {
    return {
      chunks: [
        makeChunk({
          body: text,
          result: whole,
          continued: false,
          index: 0,
          boundaryRule: '-',
          chosenBy: 'fit',
        }),
      ],
      nSlides: 1,
      minSlides: 1,
    };
  }
  const search = new SplitSearch(text, layout, prefix);
  const extraSlides = Math.max(
    0,
    Math.min(search.tokens.length, Math.floor(options.extraSlides ?? 0)),
  );
  const solution = search.solve(extraSlides);
  const chunks: SplitChunk[] = [];
  let slidesLeft = solution.minSlides + extraSlides;
  let i = 0;
  while (i < search.tokens.length) {
    const candidates = search.candidates(i, slidesLeft, solution);
    const choice = yield {
      text,
      remaining: text.slice(search.tokens[i]?.start ?? 0),
      candidates,
    };
    const pick = candidates[choice.index];
    if (pick === undefined) throw new Error('No Bible split candidate');
    chunks.push(
      makeChunk({
        body: pick.text,
        result: search.at(i, pick.tokenIndex),
        continued: pick.tokenIndex !== search.tokens.length,
        index: chunks.length,
        boundaryRule: pick.ruleLabel,
        chosenBy: candidates.length === 1 ? 'forced' : choice.by,
      }),
    );
    i = pick.tokenIndex;
    slidesLeft--;
  }
  return {chunks, nSlides: chunks.length, minSlides: solution.minSlides};
}

/** Copible's global DP without any asynchronous work on the rules-only path. */
export function splitVerse(
  text: string,
  layout: SplitLayout,
  options: SplitOptions = {},
): SplitResult {
  const steps = splitSteps(text, layout, options);
  let step = steps.next();
  while (!step.done) step = steps.next({index: 0, by: 'rules'});
  return step.value;
}

/** Asks only between fitting candidates and falls back independently at each boundary. */
export async function splitVerseWithChooser(
  text: string,
  layout: SplitLayout,
  options: SplitOptions & {readonly chooser: BoundaryChooser},
): Promise<SplitResult> {
  const steps = splitSteps(text, layout, options);
  let step = steps.next();
  while (!step.done) {
    const {text: fullText, remaining, candidates} = step.value;
    let choice: SplitChoice = {index: 0, by: 'rules'};
    if (candidates.length > 1) {
      try {
        const selected = await options.chooser(fullText, remaining, candidates);
        choice = {
          index: Number.isFinite(selected)
            ? Math.max(0, Math.min(Math.trunc(selected), candidates.length - 1))
            : 0,
          by: 'llm',
        };
      } catch {
        choice = {index: 0, by: 'rules'};
      }
    }
    step = steps.next(choice);
  }
  return step.value;
}
