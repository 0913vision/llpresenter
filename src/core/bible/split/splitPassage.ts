import type {BibleCutsFile} from '../../schema/bibleCuts';
import type {BibleLookupPassage} from '../../schema/bibleLookup';
import type {BibleSlides} from '../../schema/biblePassage';
import type {SlideTransition} from '../../schema/slideTransition';
import {newBibleSlide, verseText} from '../../services/passageEdits';
import {verseKey, versesOfPassage} from '../bibleTiles';
import type {SplitLayout} from './layout';
import {
  keptVerseParts,
  splitVerseParts,
  type VerseInput,
  type VersePart,
} from './splitVerses';

/** A passage cut into parts that fit the text box of its theme. */
export interface PassageSplit {
  readonly layout: SplitLayout;
  readonly verses: readonly VerseInput[];
  readonly parts: readonly VersePart[];
  /** Whether each verse starts with its number. */
  readonly numbered: boolean;
}

/** Keeps the slides a verse already has, and cuts the others to fit. */
export function splitPassage(
  passage: BibleLookupPassage,
  {
    layout,
    saved,
    slides,
    verseNumbers,
  }: {
    readonly layout: SplitLayout;
    readonly saved?: BibleCutsFile | undefined;
    readonly slides?: BibleSlides | undefined;
    readonly verseNumbers: boolean;
  },
): PassageSplit {
  const verses = versesOfPassage(passage);
  const numbered = verseNumbers && verses.length > 1;
  return {
    layout,
    numbered,
    verses: verses.map(({reference, text}) => ({
      reference,
      text: verseText(slides, reference, text),
    })),
    parts: verses.flatMap(
      verse =>
        keptVerseParts(verse, slides) ??
        splitVerseParts(verse, layout, {
          saved,
          prefix: numbered ? `${verse.reference.verse} ` : '',
        }),
    ),
  };
}

/** The slides to keep for these parts; a verse that has some keeps them. */
export function slidesOfParts(
  parts: readonly VersePart[],
  {
    slides,
    transition,
  }: {
    readonly slides?: BibleSlides | undefined;
    readonly transition?: SlideTransition | undefined;
  } = {},
): BibleSlides {
  const next: Record<string, BibleSlides[string]> = {};
  for (const part of parts) {
    const key = verseKey(part.reference);
    const kept = slides?.[key];
    if (kept !== undefined) next[key] = kept;
    else {
      next[key] = [...(next[key] ?? []), newBibleSlide(part.text, transition)];
    }
  }
  for (const [key, kept] of Object.entries(slides ?? {})) {
    if (kept.length === 0) next[key] = kept;
  }
  return next;
}
