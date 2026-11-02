import {describe, expect, it} from 'vitest';
import {
  isFrameRateReport,
  isRendererLogEntry,
  parseFrameRateReport,
  parseRendererLogEntry,
  parseFrameReadyReport,
  parseFrameReadyReply,
  parseOpenWindowResult,
  parseOrderEditorTarget,
  parseSongEditorTarget,
  refuseOpenWindow,
} from '@core/schema/ipcPayloads';

describe('frame readiness', () => {
  it('accepts a current version and boolean acknowledgment', () => {
    const value = {
      screenId: 'main',
      version: 7,
      width: 1920,
      height: 1080,
      ready: true,
    };
    expect(parseFrameReadyReport(value)).toEqual({ok: true, value});
    expect(parseFrameReadyReply(false)).toEqual({ok: true, value: false});
  });
  it.each([
    {screenId: 'main', version: 1, width: 0, height: 1080, ready: true},
    {screenId: 'main', version: 1, width: 1920, height: Infinity, ready: true},
    {screenId: 'main', version: 1, width: 1920, height: 1080, ready: 'yes'},
    {screenId: '', version: 1},
    {screenId: 'x'.repeat(201), version: 0},
    {screenId: 'main', version: -1},
    {screenId: 'main', version: 0.5},
    {screenId: 'main', version: Infinity},
    {screenId: 'main', version: Number.MAX_SAFE_INTEGER + 1},
  ])('rejects malformed ready reports %j', value => {
    expect(parseFrameReadyReport(value).ok).toBe(false);
  });
});

describe('parseRendererLogEntry', () => {
  it('accepts an entry with and without a detail', () => {
    const entry = {level: 'error', message: 'render failed', detail: 'stack'};

    expect(parseRendererLogEntry(entry)).toEqual({ok: true, value: entry});
    expect(isRendererLogEntry({level: 'info', message: 'started'})).toBe(true);
  });

  it('accepts the longest message and detail', () => {
    expect(
      isRendererLogEntry({
        level: 'warn',
        message: 'm'.repeat(500),
        detail: 'd'.repeat(4000),
      }),
    ).toBe(true);
  });

  it.each([
    ['an unknown level', {level: 'debug'}, 'level'],
    ['an empty message', {message: ''}, 'message'],
    ['a message over 500 characters', {message: 'm'.repeat(501)}, 'message'],
    ['a detail over 4000 characters', {detail: 'd'.repeat(4001)}, 'detail'],
    ['a detail that is not text', {detail: {stack: 'x'}}, 'detail'],
  ])('rejects %s', (_name, change, field) => {
    const result = parseRendererLogEntry({
      level: 'error',
      message: 'render failed',
      ...change,
    });

    expect(result.ok ? undefined : result.error.field).toBe(field);
  });
});

describe('parseFrameRateReport', () => {
  it('accepts frame rates from 0 to 240, fractions included', () => {
    for (const fps of [0, 59.94, 240]) {
      expect(parseFrameRateReport({screenId: 'main', fps})).toEqual({
        ok: true,
        value: {screenId: 'main', fps},
      });
    }
  });

  it.each([
    ['a negative rate', {fps: -1}, 'fps'],
    ['a rate over 240', {fps: 241}, 'fps'],
    ['an infinite rate', {fps: Infinity}, 'fps'],
    ['a rate that is not a number', {fps: NaN}, 'fps'],
    ['an empty screen id', {screenId: ''}, 'screenId'],
  ])('rejects %s', (_name, change, field) => {
    const result = parseFrameRateReport({screenId: 'main', fps: 60, ...change});

    expect(result.ok ? undefined : result.error.field).toBe(field);
  });

  it('rejects values that are not objects', () => {
    expect(isFrameRateReport(null)).toBe(false);
    expect(isFrameRateReport([60])).toBe(false);
  });
});

describe('editor window targets', () => {
  const SERVICE = 'a41e0c52-7e1f-4a2b-8c3d-4e5f60718293';
  const ITEM = '00000000-0000-4000-8000-000000000001';
  const SONG = '6f1c2a9e-4b7d-4c1a-9e2f-0123456789ab';

  it('accepts an order editor target and drops unknown fields', () => {
    expect(
      parseOrderEditorTarget({serviceId: SERVICE, itemId: ITEM, extra: 1}),
    ).toEqual({ok: true, value: {serviceId: SERVICE, itemId: ITEM}});
  });

  it.each([null, [], {serviceId: SERVICE}, {serviceId: 'x', itemId: ITEM}])(
    'refuses the order editor target %j',
    value => {
      expect(parseOrderEditorTarget(value).ok).toBe(false);
    },
  );

  it('accepts a song editor target with and without its options', () => {
    expect(parseSongEditorTarget({songId: SONG})).toEqual({
      ok: true,
      value: {songId: SONG},
    });
    const full = {
      songId: SONG,
      block: 2,
      arrangement: '짧게',
      action: 'hot-key',
    };
    expect(parseSongEditorTarget(full)).toEqual({ok: true, value: full});
  });

  it.each([
    {songId: 'x'},
    {songId: SONG, block: -1},
    {songId: SONG, block: 1.5},
    {songId: SONG, action: 'delete-song'},
    {songId: SONG, arrangement: 3},
  ])('refuses the song editor target %j', value => {
    expect(parseSongEditorTarget(value).ok).toBe(false);
  });

  it('reads a window answer and refuses an unknown reason', () => {
    expect(parseOpenWindowResult({ok: true})).toEqual({
      ok: true,
      value: {ok: true, value: undefined},
    });
    expect(
      parseOpenWindowResult({ok: false, error: {reason: 'no-such-target'}}),
    ).toEqual({
      ok: true,
      value: {ok: false, error: {reason: 'no-such-target'}},
    });
    expect(
      parseOpenWindowResult({ok: false, error: {reason: 'other'}}).ok,
    ).toBe(false);
    expect(refuseOpenWindow()).toEqual({
      ok: false,
      error: {reason: 'failed'},
    });
  });
});
