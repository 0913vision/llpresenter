import {describe, expect, it} from 'vitest';
import {BIBLE_BOOKS} from '@core/bible/bibleBooks';
import {BOOK_SUGGESTION_LIMIT, matchBooks} from '@core/bible/bibleMatching';

describe('Bible book metadata and matching', () => {
  it('contains all 66 books in canonical order with 1189 chapters', () => {
    expect(BIBLE_BOOKS.map(book => book.id)).toEqual(
      Array.from({length: 66}, (_, index) => index + 1),
    );
    expect(BIBLE_BOOKS.filter(book => book.testament === 'old')).toHaveLength(
      39,
    );
    expect(BIBLE_BOOKS.filter(book => book.testament === 'new')).toHaveLength(
      27,
    );
    expect(BIBLE_BOOKS.reduce((count, book) => count + book.chapters, 0)).toBe(
      1189,
    );
    expect(BIBLE_BOOKS[0]).toMatchObject({korean: '창세기', chapters: 50});
    expect(BIBLE_BOOKS[65]).toMatchObject({korean: '요한계시록', chapters: 22});
  });

  it('recognizes every full and short Korean and English name exactly', () => {
    for (const book of BIBLE_BOOKS) {
      for (const name of [
        book.korean,
        book.koreanShort,
        book.english,
        book.englishShort,
      ]) {
        expect(
          matchBooks(name).map(match => match.id),
          name,
        ).toEqual([book.id]);
      }
    }
  });

  it.each([
    '창',
    '창세',
    '차',
    'ckd',
    'ckdtp',
    'GEN',
    'Genesis',
    ' 창 세 기 ',
    '창세기'.normalize('NFD'),
  ])('completes %j to Genesis', name => {
    expect(matchBooks(name).map(book => book.korean)).toEqual(['창세기']);
  });

  it('offers ambiguous prefixes in canonical order and gives exact names priority', () => {
    expect(matchBooks('베').map(book => book.korean)).toEqual([
      '에베소서',
      '베드로전서',
      '베드로후서',
    ]);
    expect(matchBooks('요한').map(book => book.id)).toEqual([
      43, 62, 63, 64, 66,
    ]);
    expect(matchBooks('요').map(book => book.korean)).toEqual(['요한복음']);
    expect(matchBooks('1 John').map(book => book.korean)).toEqual(['요한일서']);
  });

  it('matches compound vowels and final consonants, including IME-off keys', () => {
    expect(matchBooks('왕').map(book => book.id)).toEqual([11, 12]);
    expect(matchBooks('dhkd').map(book => book.id)).toEqual([11, 12]);
    expect(matchBooks('qpe').map(book => book.id)).toEqual([60, 61]);
    expect(matchBooks('tn').map(book => book.id)).toEqual([6]);
    expect(matchBooks('dPfp').map(book => book.id)).toEqual([24, 25]);
  });

  it('bounds suggestions and rejects empty or unknown book names', () => {
    const matches = matchBooks('서');
    expect(matches).toHaveLength(BOOK_SUGGESTION_LIMIT);
    expect(matches.map(book => book.id)).toEqual(
      [...matches.map(book => book.id)].sort((a, b) => a - b),
    );
    expect(matchBooks(' ')).toEqual([]);
    expect(matchBooks('not a book')).toEqual([]);
  });
});
