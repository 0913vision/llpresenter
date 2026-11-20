import type {BibleCutEntry, BibleCutsFile} from '../../schema/bibleCuts';
import type {VerseSlide} from '../../schema/service';
import {CONT_MARKER, layoutText, type SplitLayout} from './layout';
import {cutsFromChunks, planSlides, planSlidesAtOffsets} from './manualSplit';
import {knownCutEntryFor, textHash} from './splitCache';
import {splitVerse} from './splitter';
import type {BibleEditedVerse} from '../../schema/biblePassage';
import {bibleEditedOutputLines} from '../bibleTiles';

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
  readonly edited?: true;
  readonly problem?: 'measurement';
}

/** Projects the saved boundaries of a verse that was edited in the item. */
export function projectEditedVerse(
  verse: VerseInput,
  edited: BibleEditedVerse,
  {layout, prefix}: {readonly layout: SplitLayout; readonly prefix: string},
): readonly VersePart[] {
  return edited.map((part, index) => {
    const text = part.text ?? part.source.trimEnd();
    const continued = index < edited.length - 1;
    const number = index === 0 ? prefix : '';
    const exact = bibleEditedOutputLines(text, number, continued);
    let lines = exact;
    if (part.text === undefined) {
      try {
        lines = layoutText(number + text, layout, continued).lines;
      } catch {
        lines = exact;
      }
    }
    return {
      reference: verse.reference,
      text,
      display: text + (continued ? CONT_MARKER : ''),
      continued,
      lines,
      part: index + 1,
      partCount: edited.length,
      manual: true,
      ...(part.text === undefined ? {} : {edited: true as const}),
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
