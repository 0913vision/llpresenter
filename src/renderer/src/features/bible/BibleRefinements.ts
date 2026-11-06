import type {BibleAiState} from '@core/schema/bibleAi';
import type {LlpApi} from '@contracts/ipc/api';
import type {VerseInput} from '@core/bible/split/splitVerses';
import {versesToReview} from '@core/bible/split/splitVerses';
import {
  normalizeVerse,
  cutsFromChunks,
  planSlides,
} from '@core/bible/split/manualSplit';
import {splitVerseWithChooser} from '@core/bible/split/splitter';
import type {BibleTextElement} from '@renderer/rendering/bibleMeasure';
import type {BibleProjection} from './splitProjection';

export const verseKey = (reference: VerseInput['reference']): string =>
  `${reference.translation}:${reference.book}:${reference.chapter}:${reference.verse}`;

const CACHE_LIMIT = 256;

/** Bounded, unsaved AI cuts shared by projections in this window. */
export class BibleRefinements {
  private readonly cuts = new Map<string, readonly number[]>();
  private readonly listeners = new Set<() => void>();
  private revision = 0;
  readonly getSnapshot = (): number => this.revision;
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private key(
    verse: VerseInput,
    element: BibleTextElement,
    prefix: string,
  ): string {
    return JSON.stringify([
      normalizeVerse(verse.text),
      element.text,
      element.frame,
      prefix,
    ]);
  }
  get(
    verse: VerseInput,
    element: BibleTextElement,
    prefix: string,
  ): readonly number[] | undefined {
    return this.cuts.get(this.key(verse, element, prefix));
  }
  put(
    verse: VerseInput,
    element: BibleTextElement,
    {prefix, cuts}: {readonly prefix: string; readonly cuts: readonly number[]},
  ): void {
    const key = this.key(verse, element, prefix);
    if (!this.cuts.has(key) && this.cuts.size >= CACHE_LIMIT) {
      const oldest = this.cuts.keys().next().value;
      if (oldest !== undefined) this.cuts.delete(oldest);
    }
    this.cuts.set(key, [...cuts]);
    this.revision++;
    for (const listener of this.listeners) listener();
  }
}

export const bibleRefinements = new BibleRefinements();

export interface RefinementProgress {
  readonly initialized: boolean;
  readonly pending: ReadonlySet<string>;
}

/** Refines a lookup in order, with cancellation on both sides of every await. */
export class BibleRefinementRun {
  private generation = 0;
  private lookupId: string | undefined;
  private readonly listeners = new Set<() => void>();
  private progress: RefinementProgress = {
    initialized: false,
    pending: new Set(),
  };
  readonly getSnapshot = (): RefinementProgress => this.progress;
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  constructor(
    private readonly api: LlpApi['bible'] | undefined,
    private readonly projection: BibleProjection | null,
    private readonly cache = bibleRefinements,
  ) {}

  private publish(pending: ReadonlySet<string>, initialized = true): void {
    this.progress = {initialized, pending};
    for (const listener of this.listeners) listener();
  }

  readonly cancel = (): void => {
    this.generation++;
    const lookupId = this.lookupId;
    this.lookupId = undefined;
    this.publish(new Set());
    if (lookupId !== undefined) {
      this.api
        ?.cancelBoundary({lookupId})
        .catch((error: unknown) =>
          console.error('Could not cancel Bible refinement', error),
        );
    }
  };

  async start(): Promise<void> {
    const generation = ++this.generation;
    const current = (): boolean => this.generation === generation;
    const projection = this.projection;
    const api = this.api;
    if (
      projection === null ||
      api === undefined ||
      projection.source.review === false
    ) {
      this.publish(new Set());
      return;
    }
    const references = new Set(versesToReview(projection.parts).map(verseKey));
    const prefixOf = (verse: VerseInput): string =>
      projection.numbered ? `${verse.reference.verse} ` : '';
    const verses = projection.verses.filter(
      verse =>
        references.has(verseKey(verse.reference)) &&
        this.cache.get(verse, projection.element, prefixOf(verse)) ===
          undefined,
    );
    if (verses.length === 0) {
      this.publish(new Set());
      return;
    }
    this.publish(new Set(), false);
    const status: BibleAiState = await api
      .getLlmStatus()
      .catch((error: unknown) => {
        console.error('Could not read Bible AI status', error);
        return {status: 'stopped' as const, available: false, reason: ''};
      });
    if (!current()) return;
    if (!status.available) {
      this.publish(new Set());
      return;
    }
    const lookupId = crypto.randomUUID();
    this.lookupId = lookupId;
    const pending = new Set(verses.map(verse => verseKey(verse.reference)));
    this.publish(new Set(pending));
    for (const verse of verses) {
      if (!current()) return;
      if (
        this.cache.get(verse, projection.element, prefixOf(verse)) !== undefined
      ) {
        pending.delete(verseKey(verse.reference));
        this.publish(new Set(pending));
        continue;
      }
      try {
        const prefix = prefixOf(verse);
        const result = await splitVerseWithChooser(
          verse.text,
          projection.layout,
          {
            prefix,
            chooser: async (fullText, remaining, candidates) => {
              if (!current()) throw new Error('Bible lookup cancelled');
              const chosen = await api.chooseBoundary({
                lookupId,
                fullText,
                remaining,
                candidates: candidates.map(candidate => candidate.text),
              });
              if (!current()) throw new Error('Bible lookup cancelled');
              return chosen;
            },
          },
        );
        if (!current()) return;
        const cuts = cutsFromChunks(result.chunks);
        if (planSlides(verse.text, cuts, {...projection.layout, prefix}).ok) {
          this.cache.put(verse, projection.element, {prefix, cuts});
        }
      } catch (error) {
        if (!current()) return;
        console.error('Could not refine Bible verse', error);
      }
      pending.delete(verseKey(verse.reference));
      this.publish(new Set(pending));
    }
    this.lookupId = undefined;
  }
}
