import {describe, expect, it} from 'vitest';
import {BIBLE_BOOKS} from '@core/bible/bibleBooks';
import {
  BOOK_SUGGESTION_LIMIT,
  exactBibleBook,
  findBibleBooks,
  matchBooks,
} from '@core/bible/bibleMatching';

describe('four-field book candidates', () => {
  it('distinguishes the reported chd typo from Genesis keyboard input', () => {
    for (const input of ['chd', '총']) {
      expect(exactBibleBook(input)).toBeUndefined();
      expect(findBibleBooks(input)).toEqual([]);
    }
    for (const input of ['ckd', 'ckdtprl', '창세기', '창', 'Genesis', 'GEN']) {
      expect(exactBibleBook(input)?.id).toBe(1);
    }
    for (const input of ['ㅊㅏ', '차', '창세', 'ckdtp', 'nesis']) {
      expect(findBibleBooks(input).map(book => book.id)).toEqual([1]);
    }
  });

  it.each([
    ['ezk', 'eze', 26],
    ['jol', 'joe', 29],
    ['jnh', 'jon', 32],
    ['nam', 'nah', 34],
    ['mrk', 'mar', 41],
    ['jhn', 'joh', 43],
    ['php', 'phi', 50],
  ])('recognizes current %s and retained %s codes', (current, previous, id) => {
    for (const code of [current, current.toUpperCase(), previous]) {
      expect(exactBibleBook(code)?.id).toBe(id);
      expect(matchBooks(code).map(book => book.id)).toEqual([id]);
      expect(findBibleBooks(code).some(book => book.id === id)).toBe(true);
    }
  });

  it('keeps every containment match even when a short name matches exactly', () => {
    const matches = findBibleBooks('요');
    expect(matches.map(book => book.id)).toEqual([
      18, 29, 32, 43, 62, 63, 64, 66,
    ]);
    expect(exactBibleBook('요')?.id).toBe(43);
    expect(findBibleBooks('서')).toHaveLength(
      BIBLE_BOOKS.filter(book => book.korean.includes('서')).length,
    );
    expect(findBibleBooks('서').length).toBeGreaterThan(8);
  });

  it.each([
    ['베', [49, 60, 61]],
    ['dhkd', [11, 12]],
    ['왕', [11, 12]],
    ['qpe', [60, 61]],
    ['dPfp', [24, 25]],
    ['요한', [43, 62, 63, 64, 66]],
  ])('matches jamo and IME-off text %s in canonical order', (input, ids) => {
    expect(findBibleBooks(input).map(book => book.id)).toEqual(ids);
  });

  it('matches English names and codes while retaining all candidates', () => {
    expect(findBibleBooks('GEN').map(book => book.id)).toEqual([1]);
    expect(findBibleBooks('John').map(book => book.id)).toEqual([
      43, 62, 63, 64,
    ]);
    expect(exactBibleBook('1 John')?.id).toBe(62);
    expect(exactBibleBook('ckd')?.id).toBe(1);
    expect(exactBibleBook('베')).toBeUndefined();
    expect(findBibleBooks('')).toEqual([]);
    expect(findBibleBooks('unknown')).toEqual([]);
  });
});

describe('matchBooks', () => {
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
