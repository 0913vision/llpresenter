import {describe, expect, it} from 'vitest';
import {
  BIBLE_LOOKUP_LIMITS,
  parseBibleLookupReply,
  parseBibleLookupRequest,
} from './bibleLookup';

const request = {translation: 'sample', input: '요 3:16-18'};
const reply = {
  ...request,
  suggestions: [{bookId: 43, name: '요한복음', input: '요한복음 3:16-18'}],
  result: {
    ok: true,
    value: {
      translation: 'sample',
      ref: '요한복음 3:16-18',
      displayRef: '요한복음 3:16-18',
      verses: [{chapter: 3, verse: 16, text: 'Invented verse'}],
    },
  },
};

function parsedRequest() {
  const parsed = parseBibleLookupRequest(request);
  if (!parsed.ok) throw new Error('Invalid request fixture');
  return parsed.value;
}

describe('Bible lookup payloads', () => {
  it('accepts optional header bounds without passage text and strips unknown fields', () => {
    expect(
      parseBibleLookupReply(parsedRequest(), {
        ...reply,
        bounds: {bookId: 43, chapterVerses: [8, 8, 36], extra: true},
      }),
    ).toMatchObject({
      ok: true,
      value: {bounds: {bookId: 43, chapterVerses: [8, 8, 36]}},
    });
  });

  it.each([
    null,
    {},
    {bookId: 0, chapterVerses: [1]},
    {bookId: 67, chapterVerses: [1]},
    {bookId: 43, chapterVerses: []},
    {bookId: 43, chapterVerses: [0]},
    {bookId: 43, chapterVerses: [1.5]},
    {bookId: 43, chapterVerses: ['1']},
    {bookId: 43, chapterVerses: [BIBLE_LOOKUP_LIMITS.verses + 1]},
    {
      bookId: 43,
      chapterVerses: Array.from(
        {length: BIBLE_LOOKUP_LIMITS.chapters + 1},
        () => 1,
      ),
    },
  ])('rejects malformed or unbounded book metadata %#', bounds => {
    expect(parseBibleLookupReply(parsedRequest(), {...reply, bounds}).ok).toBe(
      false,
    );
  });

  it('accepts optional normalized suggestion metadata and strips unknown fields', () => {
    const suggestion = {
      ...reply.suggestions[0],
      resolved: {ref: '요한복음 3:16-18', verseCount: 3, extra: true},
    };
    const parsed = parseBibleLookupReply(parsedRequest(), {
      ...reply,
      suggestions: [suggestion],
    });
    expect(parsed).toMatchObject({
      ok: true,
      value: {
        suggestions: [{resolved: {ref: '요한복음 3:16-18', verseCount: 3}}],
      },
    });
    if (!parsed.ok) throw new Error('Expected valid suggestion metadata');
    expect(parsed.value.suggestions[0]?.resolved).toEqual({
      ref: '요한복음 3:16-18',
      verseCount: 3,
    });
  });
  it.each([
    {ref: '', verseCount: 1},
    {ref: 'x'.repeat(BIBLE_LOOKUP_LIMITS.input + 1), verseCount: 1},
    {ref: '요한복음 3:16', verseCount: 0},
    {ref: '요한복음 3:16', verseCount: BIBLE_LOOKUP_LIMITS.verses + 1},
    {ref: '요한복음 3:16'},
  ])('rejects malformed normalized suggestion metadata %#', resolved => {
    expect(
      parseBibleLookupReply(parsedRequest(), {
        ...reply,
        suggestions: [{...reply.suggestions[0], resolved}],
      }).ok,
    ).toBe(false);
  });
  it('accepts empty input and strips unknown IPC fields', () => {
    expect(
      parseBibleLookupRequest({...request, input: '', extra: true}),
    ).toEqual({
      ok: true,
      value: {...request, input: ''},
    });
    expect(parseBibleLookupReply(parsedRequest(), reply)).toEqual({
      ok: true,
      value: reply,
    });
  });

  it.each([
    null,
    [],
    {...request, translation: ''},
    {
      ...request,
      translation: 'x'.repeat(BIBLE_LOOKUP_LIMITS.translationId + 1),
    },
    {...request, input: 3},
    {...request, input: 'x'.repeat(BIBLE_LOOKUP_LIMITS.input + 1)},
  ])('rejects malformed request %j', value => {
    expect(parseBibleLookupRequest(value).ok).toBe(false);
  });

  it.each([
    {...reply, input: '창 1:1'},
    {...reply, translation: 'other'},
    {
      ...reply,
      suggestions: Array.from({length: 9}, () => reply.suggestions[0]),
    },
    {...reply, suggestions: [{bookId: 67, name: 'Unknown', input: 'Unknown'}]},
    {...reply, result: {ok: false, error: {code: 'other', message: ''}}},
    {...reply, result: {ok: true, value: {...reply.result.value, verses: []}}},
    {
      ...reply,
      result: {ok: true, value: {...reply.result.value, translation: 'other'}},
    },
    {
      ...reply,
      result: {
        ok: true,
        value: {
          ...reply.result.value,
          verses: [{chapter: 0, verse: 1, text: 'Invented'}],
        },
      },
    },
    {
      ...reply,
      result: {
        ok: true,
        value: {
          ...reply.result.value,
          verses: [
            {
              chapter: 1,
              verse: 1,
              text: 'x'.repeat(BIBLE_LOOKUP_LIMITS.verseText + 1),
            },
          ],
        },
      },
    },
  ])('rejects mismatched or malformed reply %#', value => {
    expect(parseBibleLookupReply(parsedRequest(), value).ok).toBe(false);
  });

  it('returns a reference problem as a valid reply', () => {
    const value = {
      ...reply,
      result: {ok: false, error: {code: 'verse', message: '없는 절입니다'}},
    };
    expect(parseBibleLookupReply(parsedRequest(), value)).toEqual({
      ok: true,
      value,
    });
  });
});
