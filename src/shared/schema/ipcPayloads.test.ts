import {describe, expect, it} from 'vitest';
import {
  isFrameRateReport,
  isRendererLogEntry,
  parseFrameRateReport,
  parseRendererLogEntry,
} from './ipcPayloads';

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
