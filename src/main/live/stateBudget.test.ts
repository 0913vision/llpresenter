import {Buffer} from 'node:buffer';
import {describe, expect, it} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import {LIVE_STATE_BYTE_BUDGET} from '@core/schema/liveLimits';
import {serializeRecoveryRecord} from '@core/schema/recoveryRecord';
import {liveStateBytes, fitsLiveStateByteBudget} from './stateBudget';

describe('live state byte counting', () => {
  it.each([
    '',
    'ASCII',
    '가나다',
    'café',
    '😀',
    '\ud800',
    '\udfff',
    'quote"slash\\',
    '\n\r\t\b\f\u0000\u001f',
    '😀"가\ud800',
  ])(
    'counts UTF-8 and JSON escaping for %j without building a serialized copy',
    text => {
      const state = {
        ...emptyLiveState(),
        future: {
          text,
          number: 1e-8,
          empty: {},
          items: [true, false, null, text, undefined],
        },
      };
      const actual = Buffer.byteLength(`${JSON.stringify({state}, null, 2)}\n`);
      expect(liveStateBytes(state)).toBe(actual);
      expect(liveStateBytes(state, 'upperBound')).toBeGreaterThanOrEqual(
        actual,
      );
    },
  );

  it('counts empty and sparse arrays, omitted undefined fields, and repeated references', () => {
    const shared = {text: 'Invented'};
    const state = {
      ...emptyLiveState(),
      optional: undefined,
      items: new Array<unknown>(3),
      shared: [shared, shared],
      empty: [],
    };
    expect(liveStateBytes(state)).toBe(
      Buffer.byteLength(`${JSON.stringify({state}, null, 2)}\n`),
    );
    const numbers = {
      ...emptyLiveState(),
      future: [NaN, Infinity, -Infinity, -0, 2e30],
    };
    expect(liveStateBytes(numbers)).toBe(
      Buffer.byteLength(`${JSON.stringify({state: numbers}, null, 2)}\n`),
    );
  });

  it('keeps counts correct with hundreds of distinct strings and escaped property names', () => {
    const state = {
      ...emptyLiveState(),
      future: {
        ['quote"\\\n😀']: Array.from(
          {length: 400},
          (_, i) => `${i}: Invented ${'가'.repeat(i % 20)}`,
        ),
      },
    };
    const actual = Buffer.byteLength(`${JSON.stringify({state}, null, 2)}\n`);
    expect(liveStateBytes(state)).toBe(actual);
    expect(liveStateBytes(state, 'upperBound')).toBeGreaterThanOrEqual(actual);
  });

  it('accepts the aggregate budget and rejects one byte more while leaving room for the record header', () => {
    const base = {...emptyLiveState(), futurePadding: ''};
    const atLimit = {
      ...base,
      futurePadding: 'x'.repeat(LIVE_STATE_BYTE_BUDGET - liveStateBytes(base)),
    };
    expect(fitsLiveStateByteBudget(atLimit)).toBe(true);
    expect(
      fitsLiveStateByteBudget({
        ...atLimit,
        futurePadding: `${atLimit.futurePadding}x`,
      }),
    ).toBe(false);
    expect(
      serializeRecoveryRecord({
        format: 'llrecovery',
        schemaVersion: 1,
        savedAt: '2026-10-26T00:00:00.000Z',
        serviceId: null,
        state: atLimit,
      }).ok,
    ).toBe(true);
  });

  it('rejects cycles, non-JSON objects, unsupported values, and excessive depth', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic['self'] = cyclic;
    expect(fitsLiveStateByteBudget({...emptyLiveState(), future: cyclic})).toBe(
      false,
    );
    for (const future of [new Date(), Symbol('unsupported'), () => 0, 1n]) {
      expect(fitsLiveStateByteBudget({...emptyLiveState(), future})).toBe(
        false,
      );
    }
    let deep: unknown = null;
    for (let depth = 0; depth < 66; depth++) deep = {next: deep};
    expect(fitsLiveStateByteBudget({...emptyLiveState(), future: deep})).toBe(
      false,
    );
  });
});
