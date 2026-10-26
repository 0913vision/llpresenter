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
          verses: [{chapter: 1, verse: 1, text: 'x'.repeat(20_001)}],
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
