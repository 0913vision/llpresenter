import {
  exactBibleBook,
  findBibleBooks,
  reconcileReferenceFields,
  referenceFieldsState,
  selectedBook,
} from '@core/bible';
import type {BibleLookupApi} from '@contracts/ipc/bible';
import type {BibleLookupPassage} from '@core/schema/bibleLookup';
import {LIVE_BOUNDS, fullReferenceCandidate} from './referenceForm';
import {useBibleLookup} from './useBibleLookup';
import type {ReferenceEntry} from './useReferenceEntry';

const ignorePreview = (): void => undefined;

/**
 * What the entry reads as: the book it names, the bounds of that book, the
 * state of every field, and three lookups. The book's own lookup tells the
 * translation; a whole reference typed in the 책 field is looked up as it is
 * typed, so Enter sends it at once; the fields' passage is the one a submit
 * sends.
 */
export function useReferenceLookups({
  api,
  entry,
  keyboardPointed,
  onPreview,
  onAhead,
}: {
  readonly api: BibleLookupApi;
  readonly entry: ReferenceEntry;
  /** The suggestion row the keyboard points at, whose book is read ahead. */
  readonly keyboardPointed: number | null;
  readonly onPreview: (passage: BibleLookupPassage) => void;
  readonly onAhead: ((passage: BibleLookupPassage) => void) | undefined;
}) {
  const {fields, setFields, recent, translation} = entry;
  const book = selectedBook(fields.book);
  const books = findBibleBooks(fields.book);
  const metadataBook =
    exactBibleBook(fields.book) ?? books[keyboardPointed ?? -1] ?? book;
  const metadata = useBibleLookup({
    api,
    translation,
    input: metadataBook?.korean ?? '',
    onPreview: ignorePreview,
  });
  const bounds =
    metadataBook === undefined ? undefined : LIVE_BOUNDS.get(metadataBook.id);
  const reconciled = reconcileReferenceFields(fields, bounds);
  if (reconciled !== fields) setFields(reconciled);
  const state = referenceFieldsState(reconciled, bounds);
  const fullReference = fullReferenceCandidate(reconciled.book);
  const ahead = useBibleLookup({
    api,
    translation,
    input: fullReference?.input ?? '',
    onPreview: onAhead ?? ignorePreview,
  });
  const input = recent?.ref ?? state.input;
  const reply = useBibleLookup({api, translation, input, onPreview});
  const passage = reply?.result.ok ? reply.result.value : undefined;
  // NOTE(0913vision): A book and a chapter with no verse ask for the whole
  // chapter.
  const chapterInput =
    fields.start === '' &&
    state.errors.chapter === undefined &&
    book !== undefined &&
    translation !== undefined
      ? `${book.korean} ${fields.chapter}`
      : null;
  const chapterNumber = /^\d+$/u.test(reconciled.chapter)
    ? Number(reconciled.chapter)
    : 0;
  return {
    books,
    metadataBook,
    bounds,
    state,
    fullReference,
    ahead,
    /** What the fields, or the chosen recent passage, ask for. */
    input,
    reply,
    passage,
    chapterInput,
    chapterNumber,
    lastVerse: bounds?.chapterVerses[chapterNumber - 1],
    effectiveTranslation:
      passage?.translation ?? metadata?.effectiveTranslation,
  };
}

export type ReferenceLookups = ReturnType<typeof useReferenceLookups>;
