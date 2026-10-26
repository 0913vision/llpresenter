import {describe, expect, it} from 'vitest';
import {MEDIA_LIMITS} from './mediaList';
import {parseMediaCheckRequest, parseMissingMedia} from './mediaFiles';

const ID = 'd74b3f85-ab42-4d5e-9f60-718293041526';

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
