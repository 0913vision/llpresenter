import {exactBibleBook, findBibleBooks} from './bibleMatching';
import type {BibleLookupReply} from '../schema/bibleLookup';

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
    book: book ? undefined : '성경 책을 골라야 합니다',
    chapter:
      !chapter || (book && chapter > book.chapters)
        ? '장을 확인해야 합니다'
        : !counts
          ? '장 정보 불러오는 중'
          : !verseCount
            ? '역본에 없는 장'
            : undefined,
    start:
      !start || (verseCount !== undefined && start > verseCount)
        ? '시작절을 확인해야 합니다'
        : verseCount === undefined
          ? '장 정보 불러오는 중'
          : undefined,
    end:
      end === undefined || (start !== undefined && end < start)
        ? '끝절을 확인해야 합니다'
        : verseCount === undefined
          ? '장 정보 불러오는 중'
          : end > verseCount
            ? '끝절을 확인해야 합니다'
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
  const enabled = {
    book: true,
    chapter: book !== undefined,
    start: book !== undefined && errors.chapter === undefined,
    end:
      book !== undefined &&
      errors.chapter === undefined &&
      errors.start === undefined,
  };
  return {book, errors, input, clampedEnd, enabled};
}

/** Clears descendants of invalid input, preserving values while bounds load. */
export function reconcileReferenceFields(
  fields: ReferenceFields,
  bounds?: BibleLookupReply['bounds'],
): ReferenceFields {
  const book = selectedBook(fields.book);
  const chapter = positiveNumber(fields.chapter);
  const start = positiveNumber(fields.start);
  const counts =
    bounds?.bookId === book?.id ? bounds?.chapterVerses : undefined;
  const count = chapter === undefined ? undefined : counts?.[chapter - 1];
  if (!book) {
    return fields.chapter || fields.start || fields.end
      ? {...fields, chapter: '', start: '', end: ''}
      : fields;
  }
  if (!chapter || chapter > book.chapters || (counts && !count)) {
    return fields.start || fields.end
      ? {...fields, start: '', end: ''}
      : fields;
  }
  if ((!start || (count !== undefined && start > count)) && fields.end) {
    return {...fields, end: ''};
  }
  return fields;
}

export function changeReferenceField(
  fields: ReferenceFields,
  part: ReferencePart,
  value: string,
): ReferenceFields {
  if (part !== 'book') {
    const whole = /^(\d+)\s*:\s*(\d+)\s*[-~\uFF5E]\s*(\d+)$/u.exec(value);
    if (whole) {
      return reconcileReferenceFields({
        ...fields,
        chapter: whole[1] ?? '',
        start: whole[2] ?? '',
        end: whole[3] ?? '',
      });
    }
    const verses =
      part === 'start' ? /^(\d+)\s*[-~\uFF5E]\s*(\d+)$/u.exec(value) : null;
    if (verses) {
      return reconcileReferenceFields({
        ...fields,
        start: verses[1] ?? '',
        end: verses[2] ?? '',
      });
    }
  }
  if (part !== 'book' && !/^\d*$/u.test(value)) return fields;
  if (fields[part] === value) return fields;
  return reconcileReferenceFields({
    ...fields,
    [part]: value,
    ...(part === 'start' ? {end: ''} : {}),
  });
}
