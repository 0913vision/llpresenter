import {describe, expect, it} from 'vitest';
import {BIBLE_BOOKS} from './bibleBooks';
import {exactBibleBook, findBibleBooks} from './bibleMatching';

describe('four-field book candidates', () => {
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
