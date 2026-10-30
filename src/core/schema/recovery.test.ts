import {describe, expect, it} from 'vitest';
import {
  parseRecoveryApply,
  parseRecoveryResult,
  parseRecoverySummary,
} from './recovery';
import {expectSuccess} from './testHelpers';

const ID = '6f1c2a9e-4b7d-4c1a-9e2f-0123456789ab';
const savedAt = '2026-10-25T12:00:00Z';
const outputs = {kind: 'outputs', screens: [{screenId: ID, name: 'Audience'}]};
const slide = {
  kind: 'slide',
  slide: {
    serviceId: ID,
    itemId: ID,
    title: 'Example',
    position: 1,
    slideCount: 3,
  },
};
const counts = {
  messages: 1,
  props: 2,
  stageMessages: 1,
  notices: 1,
  stageLayouts: 1,
};
const showing = {kind: 'showing', counts};

describe('recovery summaries', () => {
  it('accepts no dialog, each nonempty row, and all three rows', () => {
    expect(expectSuccess(parseRecoverySummary(null))).toBeNull();
    for (const rows of [
      [outputs],
      [slide],
      [showing],
      [outputs, slide, showing],
    ]) {
      const value = {savedAt, rows};
      expect(expectSuccess(parseRecoverySummary(value))).toEqual(value);
    }
  });

  it.each([
    {},
    [],
    {savedAt, rows: []},
    {savedAt: 'today', rows: [outputs]},
    {savedAt, rows: [outputs, outputs]},
    {savedAt, rows: [{kind: 'outputs', screens: []}]},
    {
      savedAt,
      rows: [
        {kind: 'outputs', screens: [...outputs.screens, ...outputs.screens]},
      ],
    },
    {
      savedAt,
      rows: [{kind: 'outputs', screens: [{screenId: 'main', name: 'A'}]}],
    },
    {savedAt, rows: [{...slide, slide: {...slide.slide, position: 3}}]},
    {savedAt, rows: [{...slide, slide: {...slide.slide, position: -1}}]},
    {savedAt, rows: [{...slide, slide: {...slide.slide, slideCount: 0}}]},
    {
      savedAt,
      rows: [
        {
          kind: 'showing',
          counts: {
            messages: 0,
            props: 0,
            stageMessages: 0,
            notices: 0,
            stageLayouts: 0,
          },
        },
      ],
    },
    {savedAt, rows: [{kind: 'showing', counts: {...counts, props: -1}}]},
    {savedAt, rows: [{kind: 'audio'}]},
    {savedAt, rows: [{kind: 'timers'}]},
    {savedAt, rows: [Object.assign([], outputs)]},
  ])('rejects unusable or malformed summary %j', value => {
    expect(parseRecoverySummary(value).ok).toBe(false);
  });
});

describe('recovery decisions', () => {
  it('accepts every nonempty subset and preserves requested order', () => {
    for (const rows of [
      ['outputs'],
      ['slide'],
      ['showing'],
      ['showing', 'slide', 'outputs'],
    ]) {
      expect(
        expectSuccess(parseRecoveryApply({savedAt, rows, extra: true})),
      ).toEqual({savedAt, rows});
    }
  });

  it.each([
    null,
    [],
    {savedAt},
    {rows: ['slide']},
    {savedAt: 'now', rows: ['slide']},
    {savedAt, rows: []},
    {savedAt, rows: ['slide', 'slide']},
    {savedAt, rows: ['audio']},
    {savedAt, rows: ['timers']},
  ])('rejects malformed selection %j', value => {
    expect(parseRecoveryApply(value).ok).toBe(false);
  });

  it('validates success and typed refusals for apply and start fresh', () => {
    expect(expectSuccess(parseRecoveryResult({ok: true, value: null}))).toEqual(
      {ok: true, value: null},
    );
    for (const reason of [
      'unavailable',
      'stale',
      'invalid-selection',
      'apply-failed',
    ]) {
      const value = {ok: false, error: {reason, message: 'Try again'}};
      expect(expectSuccess(parseRecoveryResult(value))).toEqual(value);
    }
    for (const value of [
      undefined,
      {ok: true},
      {ok: true, value: {}},
      {ok: false, error: {reason: 'other', message: ''}},
    ]) {
      expect(parseRecoveryResult(value).ok).toBe(false);
    }
  });
});
