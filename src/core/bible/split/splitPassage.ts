import type {BibleCutsFile} from '../../schema/bibleCuts';
import type {BibleLookupPassage} from '../../schema/bibleLookup';
import type {Slide, VerseReference} from '../../schema/slide';
import {
  versesOfPassage,
  verseKey,
  type CutVerse,
} from '../../slides/passageSlides';
import {CONT_MARKER, type SplitLayout} from './layout';
import {normalizeVerse} from './manualSplit';
import {splitVerseParts, type VerseInput, type VersePart} from './splitVerses';

/** A passage cut into parts that fit the text box of its theme. */
export interface PassageSplit {
  readonly layout: SplitLayout;
  readonly verses: readonly VerseInput[];
  readonly parts: readonly VersePart[];
  /** Whether each verse starts with its number. */
  readonly numbered: boolean;
}

/** The slides that show a verse, in order. */
export function slidesOfVerse(
  slides: readonly Slide[],
  verse: VerseReference,
): readonly Slide[] {
  return slides.filter(
    slide =>
      slide.verse?.translation === verse.translation &&
      verseKey(slide.verse) === verseKey(verse),
  );
}

/** The text of a slide without the number of its verse. */
function withoutNumber(text: string, verse: VerseReference): string {
  const prefix = `${verse.verse} `;
  return text.startsWith(prefix) ? text.slice(prefix.length) : text;
}

/** What the slides of a verse say, without its number. */
function keptTexts(
  slides: readonly Slide[],
  verse: VerseReference,
): readonly string[] {
  return slidesOfVerse(slides, verse).map((slide, index) => {
    const text = slide.texts['본문'] ?? '';
    return index === 0 ? withoutNumber(text, verse) : text;
  });
}

/**
 * Whether the slides of a verse still say what it says, cut between words.
 * Slides that were changed by hand beyond that are only edited by hand.
 */
export function isCutOfVerse(
  slides: readonly Slide[],
  {reference, text}: VerseInput,
): boolean {
  return (
    normalizeVerse(keptTexts(slides, reference).join(' ')) ===
    normalizeVerse(text)
  );
}

/** Keeps the slides a verse already has, and cuts the others to fit. */
export function splitPassage(
  passage: BibleLookupPassage,
  {
    layout,
    saved,
    slides = [],
    verseNumbers,
  }: {
    readonly layout: SplitLayout;
    readonly saved?: BibleCutsFile | undefined;
    readonly slides?: readonly Slide[];
    readonly verseNumbers: boolean;
  },
): PassageSplit {
  const verses = versesOfPassage(passage);
  const numbered = verseNumbers && verses.length > 1;
  const kept = new Map(
    verses.map(({reference}) => [
      verseKey(reference),
      keptTexts(slides, reference),
    ]),
  );
  return {
    layout,
    numbered,
    verses: verses.map(({reference, text}) => {
      const texts = kept.get(verseKey(reference)) ?? [];
      return {
        reference,
        text:
          texts.length === 0
            ? text
            : texts.map(part => part.trimEnd()).join(' '),
      };
    }),
    parts: verses.flatMap(verse => {
      const texts = kept.get(verseKey(verse.reference)) ?? [];
      return texts.length > 0
        ? texts.map((text, index): VersePart => ({
            reference: verse.reference,
            text,
            display: text + (index < texts.length - 1 ? CONT_MARKER : ''),
            continued: index < texts.length - 1,
            part: index + 1,
            partCount: texts.length,
            manual: true,
          }))
        : splitVerseParts(verse, layout, {
            saved,
            prefix: numbered ? `${verse.reference.verse} ` : '',
          });
    }),
  };
}

/** Cuts a verse the way a split did. */
export function cutBy({parts}: Pick<PassageSplit, 'parts'>): CutVerse {
  return (text, verse) => {
    const texts = parts
      .filter(
        part =>
          part.reference.translation === verse.translation &&
          verseKey(part.reference) === verseKey(verse),
      )
      .map(part => part.text);
    return texts.length === 0 ? [text] : texts;
  };
}
