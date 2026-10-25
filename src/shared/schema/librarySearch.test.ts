import {describe, expect, it} from 'vitest';
import {
  parseLibrarySearchRequest,
  parseLibrarySearchResult,
  LIBRARY_SEARCH_LIMITS,
} from './librarySearch';
import {expectSuccess} from './testHelpers';

const SONG_ID = '6f1c2a9e-4b7d-4c1a-9e2f-0123456789ab';
const OTHER_ID = 'a41e0c52-7e1f-4a2b-8c3d-4e5f60718293';
const hit = {
  songId: SONG_ID,
  title: '새로운 노래',
  slideCount: 3,
  match: {kind: 'title'},
};

describe('library search requests', () => {
  it.each(['', '   ', 'ㅁㅂㅇ', '새 노래', 'NFC'])(
    'leaves query %j normalization to main',
    query => {
      expect(expectSuccess(parseLibrarySearchRequest({query}))).toEqual({
        query,
        limit: LIBRARY_SEARCH_LIMITS.default,
      });
    },
  );

  it('accepts an explicit limit and strips unsupported fields', () => {
    expect(
      expectSuccess(
        parseLibrarySearchRequest({query: '새', limit: 20, future: true}),
      ),
    ).toEqual({query: '새', limit: 20});
  });

  it.each([1, LIBRARY_SEARCH_LIMITS.max])('accepts the limit %s', limit => {
    expect(
      expectSuccess(parseLibrarySearchRequest({query: '', limit})),
    ).toEqual({
      query: '',
      limit,
    });
  });

  it.each([
    null,
    [],
    '새',
    {},
    {query: 2},
    {query: '새', limit: 0},
    {query: '새', limit: 1.5},
    {query: '새', limit: undefined},
    {query: '새', limit: LIBRARY_SEARCH_LIMITS.max + 1},
    {query: '새', limit: Infinity},
    {query: '새', limit: NaN},
  ])('rejects %j', value => {
    expect(parseLibrarySearchRequest(value).ok).toBe(false);
  });
});

describe('library search results', () => {
  it('bounds replies even when the sender ignores the request limit', () => {
    const matches = Array.from(
      {length: LIBRARY_SEARCH_LIMITS.max + 1},
      (_, i) => ({
        ...hit,
        songId: `00000000-0000-4000-8000-${i.toString(16).padStart(12, '0')}`,
      }),
    );
    expect(parseLibrarySearchResult({query: '', matches}).ok).toBe(false);
    expect(
      parseLibrarySearchResult({query: '', matches: matches.slice(1)}).ok,
    ).toBe(true);
  });
  it('carries title and lyrics matches with the first original matching line', () => {
    const result = {
      query: '새',
      matches: [
        hit,
        {
          ...hit,
          songId: OTHER_ID,
          match: {kind: 'lyrics', line: '새로운 문장'},
        },
      ],
    };
    expect(expectSuccess(parseLibrarySearchResult(result))).toEqual(result);
    expect(
      expectSuccess(parseLibrarySearchResult({query: '', matches: []})),
    ).toEqual({query: '', matches: []});
  });

  it.each([
    {...hit, songId: 'song-1'},
    {...hit, title: 1},
    {...hit, slideCount: -1},
    {...hit, slideCount: 1.5},
    {...hit, match: {kind: 'lyrics'}},
    {...hit, match: {kind: 'lyrics', line: 1}},
    {...hit, match: {kind: 'other'}},
    {...hit, match: []},
  ])('rejects a malformed hit %j', value => {
    expect(parseLibrarySearchResult({query: '새', matches: [value]}).ok).toBe(
      false,
    );
  });

  it('rejects duplicate songs and malformed envelopes', () => {
    for (const value of [
      null,
      [],
      {query: 1, matches: []},
      {query: '새', matches: {}},
      {query: '새', matches: [hit, hit]},
    ]) {
      expect(parseLibrarySearchResult(value).ok).toBe(false);
    }
  });
});
