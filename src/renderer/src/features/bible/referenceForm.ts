import {
  BIBLE_BOOKS,
  BIBLE_VERSE_COUNTS,
  EMPTY_REFERENCE,
  parseReference,
  recentPassages,
  referenceFieldsState,
  type BibleBook,
  type ReferenceFields,
  type ReferencePart,
} from '@core/bible';
import type {RecentPassage} from '@core/schema/bible';
import type {TranslationId} from '@core/schema/ids';
import type {BibleSuggestion} from './BibleSuggestions';

export const NUMBER_PARTS = ['chapter', 'start', 'end'] as const;
export const REFERENCE_LABELS = {
  book: '책',
  chapter: '장',
  start: '시작절',
  end: '끝절',
} as const;

/** The verses of every chapter of every book, which bound the fields. */
export const LIVE_BOUNDS = new Map(
  BIBLE_BOOKS.map(book => [
    book.id,
    {bookId: book.id, chapterVerses: BIBLE_VERSE_COUNTS[book.id - 1] ?? []},
  ]),
);

/** The fields of a reference the form opens with. */
export function fieldsOfReference(ref: string | undefined): ReferenceFields {
  const parsed = ref === undefined ? null : parseReference(ref);
  if (!parsed?.ok) return EMPTY_REFERENCE;
  const value = parsed.value;
  return {
    book: value.book.korean,
    chapter: String(value.chapter),
    start: value.verse === null ? '' : String(value.verse),
    end:
      value.endVerse === null || value.endVerse === value.verse
        ? ''
        : String(value.endVerse),
  };
}

/** Resolve a complete reference using the same bounds as submission. */
export function fullReferenceCandidate(value: string) {
  const parsed = parseReference(value);
  if (!parsed.ok || parsed.value.chapter !== parsed.value.endChapter) {
    return null;
  }
  const reference = parsed.value;
  const bounds = LIVE_BOUNDS.get(reference.book.id);
  const last = bounds?.chapterVerses[reference.chapter - 1];
  const next: ReferenceFields = {
    book: reference.book.korean,
    chapter: String(reference.chapter),
    start: String(reference.verse ?? 1),
    end: String(reference.endVerse ?? last ?? 1),
  };
  const parsedState = referenceFieldsState(next, bounds);
  const input =
    reference.verse === null && parsedState.input
      ? `${reference.book.korean} ${reference.chapter}`
      : parsedState.input;
  const invalidPart: ReferencePart = parsedState.errors.chapter
    ? 'chapter'
    : parsedState.errors.start
      ? 'start'
      : 'end';
  return {reference, next, parsedState, input, invalidPart};
}

export function focusPart(root: HTMLElement | null, part: ReferencePart): void {
  const field = root?.querySelector<HTMLInputElement>(
    `[data-reference-part="${part}"]`,
  );
  field?.focus();
  field?.select();
}

/** The fields as they are on screen, which may be ahead of the state. */
export function readReferenceFields(
  root: HTMLElement | null,
  fallback: ReferenceFields,
): ReferenceFields {
  const current = {...fallback};
  for (const part of ['book', ...NUMBER_PARTS] as const) {
    const field = root?.querySelector<HTMLInputElement>(
      `[data-reference-part="${part}"]`,
    );
    if (field !== undefined && field !== null) current[part] = field.value;
  }
  return current;
}

/** The books that match the typed name, then the recent passages. */
export function referenceSuggestions(
  books: readonly BibleBook[],
  recents: readonly RecentPassage[],
  translation: TranslationId | undefined,
): readonly BibleSuggestion[] {
  return [
    ...books.map(candidate => ({
      key: `book:${candidate.id}`,
      bookId: candidate.id,
      group: '책',
      input: candidate.korean,
      translation,
    })),
    ...recentPassages(recents).map(item => ({
      key: `recent:${item.translation}:${item.ref}`,
      group: '최근',
      input: item.ref,
      ref: item.ref,
      translation: item.translation,
    })),
  ];
}

/**
 * The hint in an empty 장 or 절 field: the range it takes in the dialog,
 * otherwise the first or last verse.
 */
export function numberPlaceholder(
  part: (typeof NUMBER_PARTS)[number],
  {
    dialogMode,
    overlayLabels,
    chapters,
    chapter,
    lastVerse,
    start,
  }: {
    readonly dialogMode: boolean;
    readonly overlayLabels: boolean;
    /** The chapters of the book, when a book is known. */
    readonly chapters: number | undefined;
    /** The typed chapter, 0 when none. */
    readonly chapter: number;
    readonly lastVerse: number | undefined;
    readonly start: string;
  },
): string {
  if (dialogMode) {
    if (part === 'chapter') {
      return chapters === undefined
        ? REFERENCE_LABELS.chapter
        : `1~${chapters}`;
    }
    if (chapter <= 0) return REFERENCE_LABELS[part];
    if (lastVerse === undefined) return '불러오는 중...';
    return `${part === 'end' && start ? start : 1}~${lastVerse}`;
  }
  if (part !== 'chapter' && lastVerse !== undefined) {
    return String(part === 'start' ? 1 : lastVerse);
  }
  return overlayLabels ? '' : REFERENCE_LABELS[part];
}

/** What a key does in a field of the form. */
export type ReferenceKey =
  /** The browser's own handling. */
  | {readonly kind: 'pass'}
  /** Tab while Korean is composing: the book moves on after it commits. */
  | {readonly kind: 'tab-after-composition'}
  /** Esc in the dialog: empty the fields, or close when they are empty. */
  | {readonly kind: 'clear'}
  | {readonly kind: 'close-suggestions'}
  | {readonly kind: 'escape'}
  /** Back to the book field from a 장 or 절 field. */
  | {readonly kind: 'to-book'}
  | {readonly kind: 'focus'; readonly part: ReferencePart}
  | {readonly kind: 'choose-highlighted'}
  /** The key does nothing here. */
  | {readonly kind: 'ignore'}
  | {readonly kind: 'full-reference'; readonly submit: boolean}
  | {readonly kind: 'point'; readonly index: number}
  | {readonly kind: 'advance-book'}
  /** A character that is not a digit in a 장 or 절 field. */
  | {readonly kind: 'refuse'}
  /** Tab out of a field whose value is wrong: stay and show why. */
  | {readonly kind: 'block'}
  | {readonly kind: 'submit'}
  | {readonly kind: 'repeat'};

export interface ReferenceKeyEvent {
  readonly key: string;
  readonly code: string;
  readonly shift: boolean;
  /** Alt, Ctrl or Meta is down. */
  readonly command: boolean;
  readonly repeat: boolean;
  readonly composing: boolean;
  /** The value of the field the key is in. */
  readonly value: string;
}

export interface ReferenceKeyState {
  readonly dialogMode: boolean;
  /** The book suggestions are open. */
  readonly expanded: boolean;
  readonly escapes: boolean;
  readonly submissionDisabled: boolean;
  /** Whether the suggestion picked with the arrow keys is a book. */
  readonly highlightedBook: boolean;
  /** Whether a suggestion is picked with the arrow keys. */
  readonly highlighted: boolean;
  readonly pointed: number;
  readonly suggestions: number;
  readonly fields: ReferenceFields;
  readonly enabled: {readonly start: boolean; readonly end: boolean};
  readonly error: boolean;
}

const forward = (event: ReferenceKeyEvent): boolean =>
  event.key === 'Enter' || (event.key === 'Tab' && !event.shift);

/** Decides what a key does in a field of the reference form. */
export function referenceKey(
  part: ReferencePart,
  event: ReferenceKeyEvent,
  state: ReferenceKeyState,
): ReferenceKey {
  if (event.composing) {
    return part === 'book' &&
      !event.shift &&
      (event.key === 'Tab' || event.code === 'Tab')
      ? {kind: 'tab-after-composition'}
      : {kind: 'pass'};
  }
  if (event.command) return {kind: 'pass'};
  const {book, chapter, start, end} = state.fields;
  const values = [book, chapter, start, end];
  if (state.dialogMode && event.key === 'Escape') {
    return values.some(value => value !== '')
      ? {kind: 'clear'}
      : {kind: 'escape'};
  }
  if (
    state.dialogMode &&
    event.key === 'Backspace' &&
    event.value === '' &&
    part !== 'book'
  ) {
    const index = NUMBER_PARTS.indexOf(part);
    return {
      kind: 'focus',
      part: index <= 0 ? 'book' : (NUMBER_PARTS[index - 1] ?? 'book'),
    };
  }
  if (event.key === 'Escape' && state.expanded) {
    return {kind: 'close-suggestions'};
  }
  if (event.key === 'Escape' && state.escapes) return {kind: 'escape'};
  if (part === 'book') {
    if (
      state.expanded &&
      !event.repeat &&
      forward(event) &&
      state.highlightedBook
    ) {
      return {kind: 'choose-highlighted'};
    }
    if (event.key === 'Enter' && state.submissionDisabled) {
      return {kind: 'ignore'};
    }
    if (
      forward(event) &&
      !event.repeat &&
      fullReferenceCandidate(event.value) !== null
    ) {
      return {kind: 'full-reference', submit: event.key === 'Enter'};
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      return {
        kind: 'point',
        index:
          event.key === 'ArrowDown'
            ? Math.min(state.pointed + 1, state.suggestions - 1)
            : Math.max(-1, state.pointed - 1),
      };
    }
    if (event.key === 'Tab' && !event.shift) {
      return state.fields.book.trim() === '' && !state.highlighted
        ? {kind: 'pass'}
        : {kind: 'advance-book'};
    }
  }
  if (event.key === 'Escape' && part !== 'book') return {kind: 'to-book'};
  if (part === 'chapter' && event.key === ':' && state.enabled.start) {
    return {kind: 'focus', part: 'start'};
  }
  if (part === 'start' && /^[-~～]$/u.test(event.key) && state.enabled.end) {
    return {kind: 'focus', part: 'end'};
  }
  if (part !== 'book' && event.key.length === 1 && !/^\d$/u.test(event.key)) {
    return {kind: 'refuse'};
  }
  if (
    event.key === 'Tab' &&
    !event.shift &&
    state.error &&
    values.some(value => value.trim() !== '')
  ) {
    return {kind: 'block'};
  }
  if (event.key !== 'Enter') return {kind: 'pass'};
  return event.repeat ? {kind: 'repeat'} : {kind: 'submit'};
}

/**
 * Why field `part` is wrong, or nothing: a book no name matches, a verse the
 * translation leaves out or that could not be read, or the field's own
 * error once it has a value or a key could not get past it.
 */
export function fieldReason(
  part: ReferencePart,
  {
    fields,
    bookFound,
    lookup,
    blocked,
    errors,
  }: {
    readonly fields: ReferenceFields;
    /** Some book matches what the book field holds. */
    readonly bookFound: boolean;
    /** The answer of the passage lookup, when it failed. */
    readonly lookup: {readonly code: string} | undefined;
    readonly blocked: ReferencePart | null;
    readonly errors: Readonly<Record<ReferencePart, string | undefined>>;
  },
): string | undefined {
  if (part === 'book') {
    return fields.book.trim() !== '' &&
      !bookFound &&
      !parseReference(fields.book).ok
      ? '입력한 이름과 일치하는 성경 책이 없습니다.'
      : undefined;
  }
  if (part === 'start' && lookup !== undefined) {
    return lookup.code === 'omitted'
      ? '이 역본에 없는 절'
      : '구절 불러오기 실패';
  }
  return fields[part] !== '' || blocked === part ? errors[part] : undefined;
}
