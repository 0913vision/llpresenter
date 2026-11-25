import {describe, expect, it} from 'vitest';
import {SNIPPET_LENGTH, searchMatchRange, searchSnippet} from '@core/search';

describe('searchMatchRange', () => {
  it('finds a query as the search does, ignoring case and spaces', () => {
    const text = '하나님의 사랑을 사모하는 자';
    expect(searchMatchRange(text, '사랑')).toEqual({start: 5, end: 7});
    expect(searchMatchRange(text, '님의사')).toEqual({start: 2, end: 6});
    expect(searchMatchRange('Amazing Grace', 'GRACE')).toEqual({
      start: 8,
      end: 13,
    });
  });

  it('finds a query of initial consonants by the initials of the syllables', () => {
    expect(searchMatchRange('주만 바라볼지라', 'ㅂㄹㅂ')).toEqual({
      start: 3,
      end: 6,
    });
  });

  it('finds nothing for an empty query or one that is not there', () => {
    expect(searchMatchRange('주만 바라볼지라', '  ')).toBeNull();
    expect(searchMatchRange('주만 바라볼지라', '은혜')).toBeNull();
  });
});

describe('searchSnippet', () => {
  it('keeps a short line whole', () => {
    const text = '하나님의 사랑을 사모하는 자';
    const match = {start: 5, end: 7};
    expect(searchSnippet(text, match)).toEqual({text, match});
  });

  it('cuts a long line around the match and marks the cuts', () => {
    const text = `${'가'.repeat(50)}사랑${'나'.repeat(50)}`;
    const snippet = searchSnippet(text, {start: 50, end: 52});
    expect(snippet.text.startsWith('…')).toBe(true);
    expect(snippet.text.endsWith('…')).toBe(true);
    expect(snippet.text.slice(snippet.match.start, snippet.match.end)).toBe(
      '사랑',
    );
    expect(snippet.text.length).toBeLessThanOrEqual(SNIPPET_LENGTH + 2);
  });
});
