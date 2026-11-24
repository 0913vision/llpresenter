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
import type {RecentPassage} from '@core/schema/bible/bible';
import type {TranslationId} from '@core/schema/common/ids';
import type {BibleSuggestion} from './bibleSuggestion';

/** The numeric fields of a reference, in the order they are filled. */
export const NUMBER_PARTS = ['chapter', 'start', 'end'] as const;
/** The names of the four reference fields: 책, 장, 시작절 and 끝절. */
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

/** Focuses and selects the field of `part` inside `root`, if it is there. */
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
