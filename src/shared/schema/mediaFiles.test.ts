import {describe, expect, it} from 'vitest';
import {MEDIA_LIMITS} from './mediaList';
import {
  parseMediaCheckRequest,
  parseMediaRevealRequest,
  parseMissingMedia,
} from './mediaFiles';

const ID = '00000000-0000-4000-8000-000000000001';

describe('media file payloads', () => {
  it('reads the missing media ids up to the media list cap', () => {
    expect(parseMissingMedia([])).toEqual({ok: true, value: []});
    expect(parseMissingMedia([ID])).toEqual({ok: true, value: [ID]});
    expect(
      parseMissingMedia(Array.from({length: MEDIA_LIMITS.items}, () => ID)).ok,
    ).toBe(true);
  });

  it.each([
    null,
    ID,
    ['not-a-uuid'],
    Array.from({length: MEDIA_LIMITS.items + 1}, () => ID),
  ])('rejects the missing set %#', value => {
    expect(parseMissingMedia(value).ok).toBe(false);
  });

  it('reads a reveal request like a check request', () => {
    expect(parseMediaRevealRequest({mediaId: ID, extra: 1})).toEqual({
      ok: true,
      value: {mediaId: ID},
    });
    expect(parseMediaRevealRequest({mediaId: 'bad'}).ok).toBe(false);
  });

  it('reads a check request and drops unknown fields', () => {
    expect(parseMediaCheckRequest({mediaId: ID, extra: 1})).toEqual({
      ok: true,
      value: {mediaId: ID},
    });
    for (const value of [null, {}, {mediaId: 'bad'}, [ID]]) {
      expect(parseMediaCheckRequest(value).ok).toBe(false);
    }
  });
});
