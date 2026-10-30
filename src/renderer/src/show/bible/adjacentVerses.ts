import {exactBibleBook} from '@shared/bibleMatching';
import type {
  BibleLookupPassage,
  BibleLookupReply,
} from '@shared/schema/bibleLookup';

export type VerseDirection = 'previous' | 'next';

export function passageBook(passage: Pick<BibleLookupPassage, 'ref'>) {
  return exactBibleBook(passage.ref.split(' ')[0] ?? '');
}

/** Extends one endpoint inside the same book using the translation's counts. */
export function adjacentVerseRange(
  passage: Pick<BibleLookupPassage, 'ref'>,
  bounds: BibleLookupReply['bounds'],
  direction: VerseDirection,
): string | null {
  const book = passageBook(passage);
  const range = /^.+ (\d+)(?::(\d+)(?:-(?:(\d+):)?(\d+))?)?$/u.exec(
    passage.ref,
  );
  if (!book || !range || bounds?.bookId !== book.id) return null;
  const counts = bounds.chapterVerses;
  let start = {chapter: Number(range[1]), verse: Number(range[2] ?? 1)};
  let end = {chapter: Number(range[3] ?? range[1]), verse: 0};
  end.verse = Number(range[4] ?? range[2] ?? counts[end.chapter - 1]);
  if (direction === 'previous') {
    if (start.verse > 1) start.verse--;
    else {
      const count = counts[start.chapter - 2];
      if (count === undefined) return null;
      start = {chapter: start.chapter - 1, verse: count};
    }
  } else if (end.verse < (counts[end.chapter - 1] ?? 0)) {
    end.verse++;
  } else {
    if (counts[end.chapter] === undefined) return null;
    end = {chapter: end.chapter + 1, verse: 1};
  }
  const ending = start.chapter === end.chapter ? '' : `${end.chapter}:`;
  return `${book.korean} ${start.chapter}:${start.verse}-${ending}${end.verse}`;
}
