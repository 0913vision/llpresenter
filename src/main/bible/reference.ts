import type {Result} from '@core/common/result';
import {BIBLE_LOOKUP_LIMITS} from '@core/schema/bibleLookup';
import type {BibleChunkHeader} from '@core/schema/bibleChunks';
import type {TranslationId} from '@core/schema/ids';
import type {BibleBook} from '@core/bible/bibleBooks';
import {matchBooks} from '@core/bible/bibleMatching';

export type ReferenceErrorCode =
  | 'syntax'
  | 'unknownBook'
  | 'ambiguousBook'
  | 'missingBook'
  | 'chapter'
  | 'verse'
  | 'reversed'
  | 'omitted'
  | 'translation';

export interface ReferenceProblem {
  readonly code: ReferenceErrorCode;
  readonly message: string;
  readonly suggestions?: readonly BibleBook[];
}

export interface ParsedReference {
  readonly book: BibleBook;
  readonly chapter: number;
  readonly verse: number | null;
  readonly endChapter: number;
  readonly endVerse: number | null;
}

export interface PassageVerse {
  readonly chapter: number;
  readonly verse: number;
  readonly text: string;
}

export interface ResolvedPassage {
  readonly translation: TranslationId;
  readonly ref: string;
  readonly displayRef: string;
  readonly book: BibleBook;
  readonly verses: readonly PassageVerse[];
}

export interface BiblePassageSource extends Pick<
  BibleChunkHeader,
  'id' | 'language' | 'books'
> {
  readChapter(book: number, chapter: number): Promise<readonly string[] | null>;
}

const COLON =
  /^(.+?)\s*(\d+)(?:\s*:\s*(\d+)(?:\s*[-~]\s*(?:(\d+)\s*:\s*)?(\d+))?)?$/u;
const KOREAN_CHAPTER = /^(.+?)\s*(\d+)\s*장$/u;
const KOREAN_VERSES = /^(.+?)\s*(\d+)\s*장\s*(\d+)(?:\s*[-~]\s*(\d+))?\s*절$/u;
const KOREAN_CROSS =
  /^(.+?)\s*(\d+)\s*장\s*(\d+)\s*절\s*[-~]\s*(\d+)\s*장\s*(\d+)\s*절$/u;
const BOOK_NAME = /^(?:[1-3]\s*)?[\p{L}\p{M}\s]+$/u;

function error(
  code: ReferenceErrorCode,
  message: string,
): Result<never, ReferenceProblem> {
  return {ok: false, error: {code, message}};
}

function referenceParts(
  input: string,
): ReadonlyArray<string | undefined> | null {
  const text = input.trim();
  const colon = COLON.exec(text);
  if (colon) return colon.slice(1);
  const cross = KOREAN_CROSS.exec(text);
  if (cross) return cross.slice(1);
  const verses = KOREAN_VERSES.exec(text);
  if (verses) return [verses[1], verses[2], verses[3], undefined, verses[4]];
  const chapter = KOREAN_CHAPTER.exec(text);
  return chapter ? [chapter[1], chapter[2]] : null;
}

/** Parses either colon or Korean chapter/verse syntax without mixing them. */
export function parseReference(
  input: string,
): Result<ParsedReference, ReferenceProblem> {
  const parts = referenceParts(input);
  const [name = '', chapterText, verseText, endChapterText, endVerseText] =
    parts ?? [];
  if (!parts || !BOOK_NAME.test(name.trim())) {
    return error('syntax', '알아볼 수 없는 구절입니다');
  }
  const chapter = Number(chapterText);
  const verse = verseText === undefined ? null : Number(verseText);
  const endChapter =
    endChapterText === undefined ? chapter : Number(endChapterText);
  const endVerse = endVerseText === undefined ? verse : Number(endVerseText);
  if (
    ![chapter, verse, endChapter, endVerse].every(
      number => number === null || (Number.isSafeInteger(number) && number > 0),
    )
  ) {
    return error('syntax', '알아볼 수 없는 구절입니다');
  }
  const matches = matchBooks(name);
  const book = matches[0];
  if (book === undefined) {
    return error('unknownBook', '알아볼 수 없는 성경 책입니다');
  }
  if (matches.length > 1) {
    return {
      ok: false,
      error: {
        code: 'ambiguousBook',
        message: '성경 책을 선택하세요',
        suggestions: matches,
      },
    };
  }
  return {ok: true, value: {book, chapter, verse, endChapter, endVerse}};
}

function rangeText(reference: ParsedReference, endVerse: number): string {
  const {chapter, verse, endChapter} = reference;
  if (verse === null) return String(chapter);
  const start = `${chapter}:${verse}`;
  if (endChapter !== chapter) return `${start}-${endChapter}:${endVerse}`;
  return endVerse === verse ? start : `${start}-${endVerse}`;
}

interface PlannedChapter {
  readonly chapter: number;
  readonly start: number;
  readonly end: number;
}

interface PassagePlan {
  readonly reference: ParsedReference;
  readonly endVerse: number;
  readonly chapters: readonly PlannedChapter[];
}

function planPassage(
  translation: BiblePassageSource,
  input: string,
): Result<PassagePlan, ReferenceProblem> {
  const parsed = parseReference(input);
  if (!parsed.ok) return parsed;
  const reference = parsed.value;
  const {book, chapter, verse, endChapter} = reference;
  const content = translation.books.find(candidate => candidate.id === book.id);
  if (!content) return error('missingBook', '이 역본에 없는 책입니다');
  const first = content.chapters[chapter - 1];
  const last = content.chapters[endChapter - 1];
  if (!first || !last) return error('chapter', '없는 장입니다');
  const startVerse = verse ?? 1;
  const endVerse = reference.endVerse ?? last.verses;
  if (startVerse > first.verses || endVerse > last.verses) {
    return error('verse', '없는 절입니다');
  }
  if (
    endChapter < chapter ||
    (endChapter === chapter && endVerse < startVerse)
  ) {
    return error('reversed', '구절 순서가 거꾸로입니다');
  }
  let count = 0;
  const chapters: PlannedChapter[] = [];
  for (let current = chapter; current <= endChapter; current++) {
    const start = current === chapter ? startVerse : 1;
    const end =
      current === endChapter
        ? endVerse
        : (content.chapters[current - 1]?.verses ?? 0);
    count += end - start + 1;
    if (count > BIBLE_LOOKUP_LIMITS.verses) {
      return error('verse', '조회할 수 있는 절 수를 넘었습니다');
    }
    chapters.push({chapter: current, start, end});
  }
  return {ok: true, value: {reference, endVerse, chapters}};
}

/** Validates the requested range before reading only its needed chapters. */
export async function resolvePassage(
  translation: BiblePassageSource,
  input: string,
): Promise<Result<ResolvedPassage, ReferenceProblem>> {
  const planned = planPassage(translation, input);
  if (!planned.ok) return planned;
  const {reference, endVerse, chapters} = planned.value;
  const {book} = reference;
  const verses: PassageVerse[] = [];
  for (const {chapter: current, start, end} of chapters) {
    const lines = await translation.readChapter(book.id, current);
    if (lines === null) {
      return error('translation', '사용할 수 없는 역본입니다');
    }
    for (let number = start; number <= end; number++) {
      const text = lines[number - 1];
      if (text !== undefined && text !== '') {
        verses.push({chapter: current, verse: number, text});
      }
    }
  }
  if (verses.length === 0) return error('omitted', '이 역본에는 없는 절입니다');
  const range = rangeText(reference, endVerse);
  const name =
    translation.language.toLowerCase().split('-')[0] === 'ko'
      ? book.korean
      : book.english;
  return {
    ok: true,
    value: {
      translation: translation.id,
      ref: `${book.korean} ${range}`,
      displayRef: `${name} ${range}`,
      book,
      verses,
    },
  };
}
