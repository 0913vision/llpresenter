import {describe, expect, it} from 'vitest';
import {
  isInitialQuery,
  normalizeSearch,
  searchInitials,
} from '@core/search/searchText';

describe('library search text', () => {
  it('normalizes to NFC lower case without whitespace', () => {
    expect(normalizeSearch(' 만복의 근원 Amen ')).toBe('만복의근원amen');
  });

  it('turns syllables into initial consonants and spots initial queries', () => {
    expect(searchInitials('만복의근원')).toBe('ㅁㅂㅇㄱㅇ');
    expect(isInitialQuery('ㅁㅂㅇ')).toBe(true);
    expect(isInitialQuery('ㅁ복')).toBe(false);
  });
});
