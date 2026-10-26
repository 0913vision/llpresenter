import {describe, expect, it} from 'vitest';
import {
  isInitialQuery,
  normalizeSearch,
  searchInitials,
  searchRange,
} from './searchText';

describe('library search text', () => {
  it('normalizes to NFC lower case without whitespace', () => {
    expect(normalizeSearch(' 만복의 근원 Amen ')).toBe('만복의근원amen');
  });

  it('turns syllables into initial consonants and spots initial queries', () => {
    expect(searchInitials('만복의근원')).toBe('ㅁㅂㅇㄱㅇ');
    expect(isInitialQuery('ㅁㅂㅇ')).toBe(true);
    expect(isInitialQuery('ㅁ복')).toBe(false);
  });

  it('finds the matched part in the original text', () => {
    const title = '만복의 근원 하나님';
    expect(searchRange(title, '근원')).toEqual({start: 4, end: 6});
    expect(searchRange(title, '의근')).toEqual({start: 2, end: 5});
    expect(searchRange(title, 'ㅁㅂㅇ')).toEqual({start: 0, end: 3});
    expect(searchRange('Amazing Grace', 'GRACE')).toEqual({start: 8, end: 13});
    expect(searchRange(title, '없음')).toBeUndefined();
    expect(searchRange(title, '  ')).toBeUndefined();
  });
});
