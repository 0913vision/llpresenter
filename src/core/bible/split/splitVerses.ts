import type {BibleCutEntry, BibleCutsFile} from '@core/schema/bible/bibleCuts';
import type {VerseReference} from '@core/schema/slides/slide';
import {CONT_MARKER, type SplitLayout} from './layout';
import {cutsFromChunks, planSlides, planSlidesAtOffsets} from './manualSplit';
import {knownCutEntryFor, textHash} from './splitCache';
import {splitVerse} from './splitter';

/** A verse and its text to split. */
export interface VerseInput {
  readonly reference: VerseReference;
  readonly text: string;
}

/**
 * One slide of a split verse; `manual` is true when its cuts came from the
 * user.
 */
export interface VersePart extends VerseInput {
  readonly display: string;
  readonly continued: boolean;
  readonly lines?: readonly string[];
  readonly part: number;
  readonly partCount: number;
  readonly manual: boolean;
  readonly problem?: 'measurement';
}

function partsOfPlan(
  verse: VerseInput,
  plan: ReturnType<typeof planSlides>,
  manual: boolean,
): readonly VersePart[] {
  return plan.slides.map((slide, index) => ({
    reference: verse.reference,
    text: slide.text,
    display: slide.text + (slide.isLast ? '' : CONT_MARKER),
    continued: !slide.isLast,
    lines: slide.lines,
    part: index + 1,
    partCount: plan.slideCount,
    manual,
  }));
}

/**
 * Splits a verse into slides: the confirmed or saved cuts when the text is
 * unchanged, else the automatic split.
 */
export function splitVerseParts(
  verse: VerseInput,
  layout: SplitLayout,
  {
    saved,
    confirmed,
    prefix = '',
    refined,
  }: {
    readonly saved?: BibleCutsFile | undefined;
    readonly confirmed?: BibleCutEntry | undefined;
    readonly prefix?: string;
    readonly refined?: readonly number[] | undefined;
  } = {},
): readonly VersePart[] {
  try {
    const entry =
      confirmed !== undefined
        ? confirmed.hash === textHash(verse.text)
          ? confirmed
          : undefined
        : saved === undefined
          ? undefined
          : knownCutEntryFor(saved, verse.reference, verse.text);
    const plan =
      entry === undefined
        ? undefined
        : entry.unit === 'character'
          ? planSlidesAtOffsets(verse.text, entry.cuts, {...layout, prefix})
          : planSlides(verse.text, entry.cuts, {...layout, prefix});
    if (plan?.ok && plan.cuts.length === entry?.cuts.length) {
      return partsOfPlan(verse, plan, true);
    }
    if (refined !== undefined) {
      const suggested = planSlides(verse.text, refined, {...layout, prefix});
      if (suggested.ok) return partsOfPlan(verse, suggested, false);
    }
    const result = splitVerse(verse.text, layout, {prefix});
    if (result.chunks.length > 0) {
      return result.chunks.map((chunk, index) => ({
        reference: verse.reference,
        text: chunk.text,
        display: chunk.display,
        continued: chunk.continued,
        lines: chunk.lines,
        part: index + 1,
        partCount: result.nSlides,
        manual: false,
      }));
    }
  } catch {
    return [
      {
        ...verse,
        display: verse.text,
        continued: false,
        part: 1,
        partCount: 1,
        manual: false,
        problem: 'measurement' as const,
      },
    ];
  }
  return [
    {
      ...verse,
      display: verse.text,
      continued: false,
      part: 1,
      partCount: 1,
      manual: false,
    },
  ];
}

/** The cuts that produced the parts of one verse. */
export function cutsOfVerse(
  parts: readonly VersePart[],
  reference: VerseReference,
): readonly number[] {
  return cutsFromChunks(
    parts.filter(part => sameVerse(part.reference, reference)),
  );
}

function sameVerse(left: VerseReference, right: VerseReference): boolean {
  return (
    left.translation === right.translation &&
    left.book === right.book &&
    left.chapter === right.chapter &&
    left.verse === right.verse
  );
}

/**
 * The verses that were split automatically into more than one slide and still
 * need a look.
 */
export function versesToReview(
  parts: readonly VersePart[],
): readonly VerseReference[] {
  const found: VerseReference[] = [];
  for (const part of parts) {
    if (
      part.partCount > 1 &&
      !part.manual &&
      !found.some(reference => sameVerse(reference, part.reference))
    ) {
      found.push(part.reference);
    }
  }
  return found;
}
