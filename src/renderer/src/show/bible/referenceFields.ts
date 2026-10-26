import {exactBibleBook, findBibleBooks} from '@shared/bibleMatching';
import type {BibleLookupReply} from '@shared/schema/bibleLookup';

export interface ReferenceFields {
  readonly book: string;
  readonly chapter: string;
  readonly start: string;
  readonly end: string;
}

export type ReferencePart = keyof ReferenceFields;

export const EMPTY_REFERENCE: ReferenceFields = {
  book: '',
  chapter: '',
  start: '',
  end: '',
};

export function selectedBook(input: string) {
  const candidates = findBibleBooks(input);
  return (
    exactBibleBook(input) ??
    (candidates.length === 1 ? candidates[0] : undefined)
  );
}

function positiveNumber(input: string): number | undefined {
  const value = /^\d+$/u.test(input) ? Number(input) : NaN;
  return Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

/** Tab validates the literal endpoint; lookup can clamp only its upper bound. */
export function referenceFieldsState(
  fields: ReferenceFields,
  bounds: BibleLookupReply['bounds'],
) {
  const book = selectedBook(fields.book);
  const chapter = positiveNumber(fields.chapter);
  const start = positiveNumber(fields.start);
  const end = fields.end === '' ? start : positiveNumber(fields.end);
  const counts =
    bounds?.bookId === book?.id ? bounds?.chapterVerses : undefined;
  const verseCount = chapter === undefined ? undefined : counts?.[chapter - 1];
  const errors: Record<ReferencePart, string | undefined> = {
    book: book ? undefined : '성경 책 선택',
    chapter:
      !chapter || (book && chapter > book.chapters)
        ? '장 범위 확인'
        : !counts
          ? '장 정보 대기'
          : !verseCount
            ? '역본에 없는 장'
            : undefined,
    start:
      !start || (verseCount !== undefined && start > verseCount)
        ? '시작절 범위 확인'
        : verseCount === undefined
          ? '장 확인'
          : undefined,
    end:
      end === undefined || (start !== undefined && end < start)
        ? '끝절 범위 확인'
        : verseCount === undefined
          ? '장 확인'
          : end > verseCount
            ? '끝절 범위 확인'
            : undefined,
  };
  const clampedEnd =
    end !== undefined && verseCount !== undefined
      ? Math.min(end, verseCount)
      : undefined;
  const input =
    book &&
    !errors.chapter &&
    !errors.start &&
    clampedEnd !== undefined &&
    start !== undefined &&
    clampedEnd >= start
      ? `${book.korean} ${chapter}:${start}${clampedEnd === start ? '' : `-${clampedEnd}`}`
      : '';
  return {book, errors, input, clampedEnd};
}

export function changeReferenceField(
  fields: ReferenceFields,
  part: ReferencePart,
  value: string,
): ReferenceFields {
  if (fields[part] === value) return fields;
  return {...fields, [part]: value, ...(part === 'start' ? {end: ''} : {})};
}
