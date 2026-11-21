import {passageBook} from './adjacentVerses';
import {validatedPinnedVerse, type VerseInput} from './split/splitVerses';
import {textVerseKey} from '../presentation/textOverrides';
import type {BibleLookupPassage} from '../schema/bibleLookup';
import type {BiblePassage} from '../schema/biblePassage';
import type {ItemTextOverrides} from '../schema/slideTextOverrides';

function lookupVerses(
  lookup: BibleLookupPassage | undefined,
): readonly VerseInput[] {
  if (lookup === undefined) return [];
  const book = passageBook(lookup);
  if (book === undefined) return [];
  return lookup.verses.map(({chapter, verse, text}) => ({
    reference: {translation: lookup.translation, book: book.id, chapter, verse},
    text,
  }));
}

export function canonicalBibleVerseTexts(
  lookup: BibleLookupPassage | undefined,
  measured: readonly VerseInput[] | undefined,
): ReadonlyMap<string, string> {
  const texts = new Map<string, string>();
  for (const {reference, text} of measured ?? []) {
    texts.set(textVerseKey(reference), text);
  }
  for (const {reference, text} of lookupVerses(lookup)) {
    texts.set(textVerseKey(reference), text);
  }
  return texts;
}

export function stalePinnedVerseKeys(
  lookup: BibleLookupPassage | undefined,
  pins: BiblePassage['pinnedVerses'],
): ReadonlySet<string> {
  const stale = new Set<string>();
  if (pins === undefined || Object.keys(pins).length === 0) return stale;
  for (const {reference, text} of lookupVerses(lookup)) {
    const key = textVerseKey(reference);
    const pin = pins[key];
    if (pin !== undefined && validatedPinnedVerse(text, pin) === undefined) {
      stale.add(key);
    }
  }
  return stale;
}

function isStaleSlide(key: string, stale: ReadonlySet<string>): boolean {
  return (
    key.startsWith('verse:') &&
    stale.has(key.slice('verse:'.length, key.lastIndexOf(':')))
  );
}

export function withoutStaleVerseText(
  overrides: ItemTextOverrides | undefined,
  stale: ReadonlySet<string>,
): ItemTextOverrides | undefined {
  if (overrides === undefined || stale.size === 0) return overrides;
  return Object.fromEntries(
    Object.entries(overrides).filter(([key]) => !isStaleSlide(key, stale)),
  );
}

export function withoutStaleVerseDeletions(
  deleted: BiblePassage['deletedSlides'],
  stale: ReadonlySet<string>,
): BiblePassage['deletedSlides'] {
  return stale.size === 0
    ? deleted
    : deleted?.filter(key => !isStaleSlide(key, stale));
}
