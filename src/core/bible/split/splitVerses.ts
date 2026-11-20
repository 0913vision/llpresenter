import type {BibleCutEntry, BibleCutsFile} from '../../schema/bibleCuts';
import type {VerseSlide} from '../../schema/service';
import {CONT_MARKER, layoutText, type SplitLayout} from './layout';
import {
  cutsFromChunks,
  normalizeVerse,
  offsetsFromChunks,
  planSlides,
  planSlidesAtOffsets,
} from './manualSplit';
import {knownCutEntryFor, textHash} from './splitCache';
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

/** Captures original boundaries before the first text-box edit to a split verse. */
export function pinVerseParts(
  raw: string,
  parts: readonly VersePart[],
): readonly string[] | undefined {
  const offsets = offsetsFromChunks(raw, parts);
  if (offsets === undefined) return undefined;
  const text = normalizeVerse(raw);
  const boundaries = [0, ...offsets, text.length];
  return boundaries
    .slice(0, -1)
    .map((offset, index) => text.slice(offset, boundaries[index + 1]));
}

export function projectPinnedVerse(
  verse: VerseInput,
  parts: readonly string[],
  {layout, prefix}: {readonly layout: SplitLayout; readonly prefix: string},
): readonly VersePart[] {
  return parts.map((part, index) => {
    const text = part.trimEnd();
    const continued = index < parts.length - 1;
    const numbered = (index === 0 ? prefix : '') + text;
    const measured = layoutText(numbered, layout, continued);
    return {
      reference: verse.reference,
      text,
      display: text + (continued ? CONT_MARKER : ''),
      lines: measured.lines,
      continued,
      part: index + 1,
      partCount: parts.length,
      manual: true,
    };
  });
}

export function firstSlidePrefix(
  verse: VerseInput,
  {singleVerse}: {readonly singleVerse: boolean},
): string {
  return singleVerse ? '' : `${verse.reference.verse} `;
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
