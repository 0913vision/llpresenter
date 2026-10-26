import {describe, expect, it} from 'vitest';
import {
  MAX_ANALYSIS_MESSAGE_LENGTH,
  MAX_THUMBNAIL_DATA_URL_LENGTH,
  THUMBNAIL_DATA_URL_PREFIX,
  parseAnalysisReply,
} from './mediaAnalysis';

const THUMBNAIL = `${THUMBNAIL_DATA_URL_PREFIX}AAAA`;

describe('media analysis replies', () => {
  it('reads what the page found and drops unknown fields', () => {
    expect(
      parseAnalysisReply({
        ok: true,
        duration: 12.5,
        width: 1920,
        height: 1080,
        thumbnail: THUMBNAIL,
        extra: 1,
      }),
    ).toEqual({
      ok: true,
      value: {
        ok: true,
        duration: 12.5,
        width: 1920,
        height: 1080,
        thumbnail: THUMBNAIL,
      },
    });
    expect(parseAnalysisReply({ok: true})).toEqual({
      ok: true,
      value: {ok: true},
    });
  });

  it('reads why a file could not be read', () => {
    expect(
      parseAnalysisReply({ok: false, reason: 'decode', message: 'Invented'}),
    ).toEqual({
      ok: true,
      value: {ok: false, reason: 'decode', message: 'Invented'},
    });
  });

  it.each([
    null,
    [],
    {ok: true, duration: -1},
    {ok: true, duration: Number.POSITIVE_INFINITY},
    {ok: true, width: 0},
    {ok: true, height: 1.5},
    {ok: true, thumbnail: 'data:image/png;base64,AAAA'},
    {
      ok: true,
      thumbnail: THUMBNAIL.padEnd(MAX_THUMBNAIL_DATA_URL_LENGTH + 1, 'A'),
    },
    {ok: false, reason: 'busy', message: ''},
    {
      ok: false,
      reason: 'decode',
      message: 'x'.repeat(MAX_ANALYSIS_MESSAGE_LENGTH + 1),
    },
  ])('rejects the reply %#', value => {
    expect(parseAnalysisReply(value).ok).toBe(false);
  });
});
