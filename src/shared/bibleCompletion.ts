import {matchBooks} from './bibleMatching';
import {BIBLE_LOOKUP_LIMITS} from './schema/bibleLookup';

const BOOK_PREFIX = /^(\s*)((?:[1-3]\s*)?[\p{L}\p{M}\s]+)(.*)$/u;

export interface BibleBookChoice {
  readonly bookId: number;
  readonly name: string;
  readonly input: string;
}

function bookPart(input: string) {
  const match = BOOK_PREFIX.exec(input);
  if (!match) return null;
  const [, leading = '', name = '', range = ''] = match;
  return {leading, name, range, end: leading.length + name.trimEnd().length};
}

export function bibleBookChoices(input: string): readonly BibleBookChoice[] {
  const part = bookPart(input);
  if (!part) return [];
  return matchBooks(part.name).flatMap(book => {
    const value = `${part.leading}${book.korean} ${part.range}`;
    return value.length > BIBLE_LOOKUP_LIMITS.input
      ? []
      : [
          {
            bookId: book.id,
            name: book.korean,
            input: value,
          },
        ];
  });
}

/** Completes only the book part; the reference suffix stays in the single field. */
export function completeBibleBook({
  input,
  start,
  end,
  bookId,
}: {
  readonly input: string;
  readonly start: number;
  readonly end: number;
  readonly bookId?: number | undefined;
}): {readonly input: string; readonly caret: number} | null {
  const part = bookPart(input);
  if (!part || start < part.leading.length || end > part.end || start > end) {
    return null;
  }
  const choices = bibleBookChoices(input);
  const choice = choices.find(c => c.bookId === bookId) ?? choices[0];
  if (!choice) return null;
  return {
    input: choice.input,
    caret: part.leading.length + choice.name.length + 1,
  };
}
