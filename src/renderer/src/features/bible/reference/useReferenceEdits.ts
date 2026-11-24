import {
  changeReferenceField,
  EMPTY_REFERENCE,
  reconcileReferenceFields,
  referenceFieldsState,
  type ReferencePart,
} from '@core/bible';
import type {RefObject} from 'react';
import type {BibleLookupPassage} from '@core/schema/bible/bibleLookup';
import {focusPart} from './referenceForm';
import type {BookSuggestions} from './useBookSuggestions';
import type {ReferenceEntry} from './useReferenceEntry';
import type {ReferenceLookups} from './useReferenceLookups';
import type {BibleSuggestion} from './bibleSuggestion';

/** The changes an operator makes to a reference form, field by field. */
export function useReferenceEdits({
  root,
  entry,
  lookups,
  suggestions,
  moveToChapter,
  forgetSubmit,
  onIntent,
  onEdit,
}: {
  readonly root: RefObject<HTMLDivElement | null>;
  readonly entry: ReferenceEntry;
  readonly lookups: ReferenceLookups;
  readonly suggestions: BookSuggestions;
  /** Moves the caret on to 장 once the chosen book is in. */
  readonly moveToChapter: () => void;
  readonly forgetSubmit: () => void;
  readonly onIntent: (() => void) | undefined;
  readonly onEdit:
    ((equivalent: BibleLookupPassage | null) => void) | undefined;
}) {
  const {fields, setFields, setBlocked, recent, setRecent} = entry;
  const {bounds, input, passage, reply} = lookups;

  /**
   * Tells the owner of an edit, with the passage it still asks for when the
   * edit didn't change what is looked up.
   */
  const tellEdit = (nextInput: string): void => {
    onEdit?.(
      nextInput !== '' && nextInput === input ? (passage ?? null) : null,
    );
  };

  const change = (part: ReferencePart, value: string): void => {
    const next = reconcileReferenceFields(
      changeReferenceField(fields, part, value),
      bounds,
    );
    if (next === fields && value !== fields[part]) return;
    forgetSubmit();
    onIntent?.();
    if (next !== fields || recent !== undefined) {
      tellEdit(referenceFieldsState(next, bounds).input);
    }
    setRecent(null);
    setFields(next);
    setBlocked(null);
    if (part === 'book') suggestions.restart();
  };

  const chooseBook = (name: string): void => {
    change('book', name);
    suggestions.hide();
  };

  /** Takes a row of the list: a book, or a whole recent passage. */
  const chooseSuggestion = (item: BibleSuggestion, advance = true): void => {
    if (item.ref === undefined || item.translation === undefined) {
      chooseBook(item.input);
      // NOTE(0913vision): A chosen book moves on to 장, as in copible, the
      // Bible reference app.
      if (advance && item.bookId !== undefined) moveToChapter();
      return;
    }
    onIntent?.();
    onEdit?.(
      reply?.input === item.ref && reply.translation === item.translation
        ? (passage ?? null)
        : null,
    );
    setFields(EMPTY_REFERENCE);
    setBlocked(null);
    setRecent({ref: item.ref, translation: item.translation});
    suggestions.dismiss();
  };

  /** Completes the book typed so far and moves on to 장. */
  const advanceBook = (): void => {
    const book = lookups.metadataBook;
    if (book === undefined) {
      setBlocked('book');
      return;
    }
    chooseBook(book.korean);
    moveToChapter();
  };

  const clear = (): void => {
    onIntent?.();
    setFields(EMPTY_REFERENCE);
    setRecent(null);
    suggestions.hide();
    setBlocked(null);
    focusPart(root.current, 'book');
  };

  return {change, chooseSuggestion, advanceBook, clear};
}

export type ReferenceEdits = ReturnType<typeof useReferenceEdits>;
