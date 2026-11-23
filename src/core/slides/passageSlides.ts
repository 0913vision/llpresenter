import {passageBook} from '@core/bible';
import type {BibleLookupPassage} from '@core/schema/bibleLookup';
import type {BiblePassage} from '@core/schema/biblePassage';
import type {Slide, VerseReference} from '@core/schema/slide';
import {copySlide, makeSlide, transitionFor, type SlideMaking} from './make';
import {withHideNext} from './nextText';

/** The verses of a looked-up passage, each with its full reference. */
export function versesOfPassage(
  passage: BibleLookupPassage,
): ReadonlyArray<{readonly reference: VerseReference; readonly text: string}> {
  const book = passageBook(passage);
  return book === undefined
    ? []
    : passage.verses.map(({chapter, verse, text}) => ({
        reference: {
          translation: passage.translation,
          book: book.id,
          chapter,
          verse,
        },
        text,
      }));
}

/** Names a verse apart from its translation. */
export function verseKey({
  book,
  chapter,
  verse,
}: Pick<VerseReference, 'book' | 'chapter' | 'verse'>): string {
  return `${book}:${chapter}:${verse}`;
}

/** Cuts the text of a verse into the texts of its slides. */
export type CutVerse = (
  text: string,
  verse: VerseReference,
) => readonly string[];

/** The address a slide of a passage shows when it isn't the item's. */
export function passageAddress(passage: BibleLookupPassage): string {
  return passage.translationLabel === undefined
    ? passage.displayRef
    : `${passage.displayRef} (${passage.translationLabel})`;
}

/**
 * The slides of a passage: every verse on as many as its text needs. A verse
 * that keeps its slides from before keeps their settings too. The last slide
 * starts with 다음 슬라이드 내용 숨기기 on, so 무대 shows nothing past the
 * passage until the operator turns it on.
 */
export function passageSlides(
  making: SlideMaking,
  {
    passage,
    settings,
    cut,
    before = [],
    address,
  }: {
    readonly passage: BibleLookupPassage;
    readonly settings: Pick<BiblePassage, 'verseNumbers' | 'translationName'>;
    readonly cut: CutVerse;
    readonly before?: readonly Slide[];
    /** The address kept on every slide; the item's own when absent. */
    readonly address?: string | undefined;
  },
): readonly Slide[] {
  const numbered = settings.verseNumbers && passage.verses.length > 1;
  const shown =
    address ??
    (settings.translationName && passage.translationLabel !== undefined
      ? passageAddress(passage)
      : undefined);
  const slides = versesOfPassage(passage).flatMap(({reference, text}) => {
    const key = verseKey(reference);
    const kept = before.filter(
      slide =>
        slide.verse?.translation === reference.translation &&
        verseKey(slide.verse) === key,
    );
    if (kept.length > 0) return withNumber(kept, {reference, text, numbered});
    return verseSlides(making, {
      reference,
      texts: cut(text.trim(), reference).map((part, index) =>
        index === 0 && numbered ? `${reference.verse} ${part}` : part,
      ),
      address: shown,
    });
  });
  return slides.map((slide, index) =>
    withHideNext(slide, index === slides.length - 1),
  );
}

function oneRow(text: string): string {
  return text.replace(/\s+/gu, ' ').trim();
}

/**
 * The slides of a verse with its number or without it. A verse that was
 * changed by hand keeps the text it has.
 */
function withNumber(
  slides: readonly Slide[],
  {
    reference,
    text,
    numbered,
  }: {
    readonly reference: VerseReference;
    readonly text: string;
    readonly numbered: boolean;
  },
): readonly Slide[] {
  const [first, ...others] = slides;
  if (first === undefined) return slides;
  const own = first.texts['본문'] ?? '';
  const number = `${reference.verse} `;
  const bare = own.startsWith(number) ? own.slice(number.length) : own;
  const whole = [bare, ...others.map(slide => slide.texts['본문'] ?? '')];
  const wanted = numbered ? number + bare : bare;
  return wanted === own || oneRow(whole.join(' ')) !== oneRow(text)
    ? slides
    : [{...first, texts: {...first.texts, 본문: wanted}}, ...others];
}

/** The slides of one verse, cut into these texts. */
export function verseSlides(
  making: SlideMaking,
  {
    reference,
    texts,
    address,
    before = [],
  }: {
    readonly reference: VerseReference;
    readonly texts: readonly string[];
    readonly address?: string | undefined;
    readonly before?: readonly Slide[];
  },
): readonly Slide[] {
  return texts.map((text, index) => {
    const last = before.at(-1);
    const {
      continued: _continued,
      hideNext: _hide,
      ...earlier
    } = before[index] ??
    (last === undefined
      ? makeSlide(making, 'scripture', {
          texts: address === undefined ? {} : {주소: address},
          verse: reference,
        })
      : {
          ...copySlide(last),
          transition: transitionFor(making, 'scripture'),
        });
    return {
      ...earlier,
      texts: {...earlier.texts, 본문: text},
      ...(index < texts.length - 1
        ? {continued: true as const}
        : last?.hideNext === undefined
          ? {}
          : {hideNext: last.hideNext}),
    };
  });
}
