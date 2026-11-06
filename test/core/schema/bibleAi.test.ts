import {describe, expect, it} from 'vitest';
import {
  BIBLE_AI_LIMITS,
  parseBibleAiCancelled,
  parseBibleAiCancel,
  parseBibleAiIndex,
  parseBibleAiRequest,
  parseBibleAiState,
} from '@core/schema/bibleAi';
import {BIBLE_LOOKUP_LIMITS} from '@core/schema/bibleLookup';

const REQUEST = {
  lookupId: 'lookup-1',
  fullText: 'one two three',
  remaining: 'two three',
  candidates: ['two', 'two three'],
};

describe('Bible AI payloads', () => {
  it('accepts normalized texts and candidate prefixes and drops unknown fields', () => {
    expect(parseBibleAiRequest({...REQUEST, extra: true})).toEqual({
      ok: true,
      value: REQUEST,
    });
    const fullText = 'x'.repeat(BIBLE_LOOKUP_LIMITS.verseText);
    expect(
      parseBibleAiRequest({
        ...REQUEST,
        fullText,
        remaining: fullText,
        candidates: Array.from(
          {length: BIBLE_AI_LIMITS.candidates},
          () => fullText,
        ),
      }).ok,
    ).toBe(true);
    expect(parseBibleAiCancel({lookupId: 'lookup-1', extra: true})).toEqual({
      ok: true,
      value: {lookupId: 'lookup-1'},
    });
  });
  it.each([
    null,
    [],
    {},
    {...REQUEST, lookupId: ''},
    {...REQUEST, lookupId: 'x'.repeat(BIBLE_AI_LIMITS.lookupId + 1)},
    {...REQUEST, fullText: 'x'.repeat(BIBLE_LOOKUP_LIMITS.verseText + 1)},
    {...REQUEST, remaining: ''},
    {...REQUEST, remaining: 'different'},
    {...REQUEST, candidates: []},
    {...REQUEST, candidates: ['unrelated']},
    {
      ...REQUEST,
      candidates: Array.from(
        {length: BIBLE_AI_LIMITS.candidates + 1},
        () => 'two',
      ),
    },
    {...REQUEST, candidates: ['x'.repeat(BIBLE_LOOKUP_LIMITS.verseText + 1)]},
  ])('rejects an invalid chooser request %#', value =>
    expect(parseBibleAiRequest(value).ok).toBe(false),
  );
  it('checks chosen indices against the sent candidates', () => {
    for (const index of [0, 1]) {
      expect(parseBibleAiIndex(index, REQUEST).ok).toBe(true);
    }
    for (const index of [-1, 2, 0.5, NaN, Infinity, '0']) {
      expect(parseBibleAiIndex(index, REQUEST).ok).toBe(false);
    }
    for (const value of [null, {}, {lookupId: ''}, {lookupId: 3}]) {
      expect(parseBibleAiCancel(value).ok).toBe(false);
    }
    expect(parseBibleAiCancelled(true).ok).toBe(true);
    expect(parseBibleAiCancelled(1).ok).toBe(false);
  });
  it('accepts every state with matching availability and caps reasons', () => {
    for (const status of [
      'missing',
      'starting',
      'ready',
      'failed',
      'stopped',
    ]) {
      expect(
        parseBibleAiState({status, available: status === 'ready', reason: ''})
          .ok,
      ).toBe(true);
      expect(
        parseBibleAiState({status, available: status !== 'ready', reason: ''})
          .ok,
      ).toBe(false);
    }
    for (const value of [
      null,
      {},
      {status: 'unknown', available: false, reason: ''},
      {
        status: 'failed',
        available: false,
        reason: 'x'.repeat(BIBLE_LOOKUP_LIMITS.verseText + 1),
      },
    ]) {
      expect(parseBibleAiState(value).ok).toBe(false);
    }
  });
});
