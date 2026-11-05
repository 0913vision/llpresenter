import type {BibleCutsFile} from '../../schema/bibleCuts';
import type {VerseSlide} from '../../schema/service';
import {CONT_MARKER, type SplitLayout} from './layout';
import {cutsFromChunks, planSlides} from './manualSplit';
import {knownCutsFor} from './splitCache';
import {splitVerse} from './splitter';

export interface VerseInput {
  readonly reference: VerseSlide['verse'];
  readonly text: string;
}

export interface VersePart extends VerseInput {
  readonly display: string;
  readonly continued: boolean;
  readonly lines?: readonly string[];
  readonly part: number;
  readonly partCount: number;
  readonly manual: boolean;
  readonly problem?: 'measurement';
}

export function firstSlidePrefix(
  verse: VerseInput,
  {singleVerse}: {readonly singleVerse: boolean},
): string {
  return singleVerse ? '' : `${verse.reference.verse} `;
}

export function itemsFromCuts(
  verse: VerseInput,
  cuts: readonly number[],
  layout: SplitLayout & {readonly prefix?: string},
): readonly VersePart[] {
  const plan = planSlides(verse.text, cuts, layout);
  return plan.slides.map((slide, index) => ({
    reference: verse.reference,
    text: slide.text,
    display: slide.text + (slide.isLast ? '' : CONT_MARKER),
    continued: !slide.isLast,
    lines: slide.lines,
    part: index + 1,
    partCount: plan.slideCount,
    manual: true,
  }));
}

/** Saved cuts are remeasured and ignored on overflow, while the saved file stays intact. */
export function splitVersesForSlides(
  verses: readonly VerseInput[],
  layout: SplitLayout,
  saved?: BibleCutsFile,
): readonly VersePart[] {
  return verses.flatMap(verse =>
    splitVerseParts(verse, layout, {
      saved,
      prefix: firstSlidePrefix(verse, {singleVerse: verses.length === 1}),
    }),
  );
}

export function splitVerseParts(
  verse: VerseInput,
  layout: SplitLayout,
  {
    saved,
    prefix = '',
  }: {
    readonly saved?: BibleCutsFile | undefined;
    readonly prefix?: string;
  } = {},
): readonly VersePart[] {
  try {
    const cuts =
      saved === undefined
        ? undefined
        : knownCutsFor(saved, verse.reference, verse.text);
    const plan =
      cuts === undefined
        ? undefined
        : planSlides(verse.text, cuts, {...layout, prefix});
    if (plan?.ok && plan.cuts.length === cuts?.length) {
      return itemsFromCuts(verse, plan.cuts, {...layout, prefix});
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

export function cutsOfVerse(
  parts: readonly VersePart[],
  reference: VerseSlide['verse'],
): readonly number[] {
  return cutsFromChunks(
    parts.filter(part => sameVerse(part.reference, reference)),
  );
}

function sameVerse(
  left: VerseSlide['verse'],
  right: VerseSlide['verse'],
): boolean {
  return (
    left.translation === right.translation &&
    left.book === right.book &&
    left.chapter === right.chapter &&
    left.verse === right.verse
  );
}

export function versesToReview(
  parts: readonly VersePart[],
): ReadonlyArray<VerseSlide['verse']> {
  const found: Array<VerseSlide['verse']> = [];
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
