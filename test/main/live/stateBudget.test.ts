import {Buffer} from 'node:buffer';
import {describe, expect, it} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import {LIVE_STATE_BYTE_BUDGET} from '@core/schema/liveLimits';
import {serializeRecoveryRecord} from '@core/schema/recoveryRecord';
import {createTimerId, type TimerId} from '@core/schema/ids';
import {MAX_LIVE_TIMERS, type TimerRuns} from '@core/schema/timerState';
import {TIMER_NAME_LIMIT} from '@core/schema/quickTimerEdit';
import {liveStateBytes, fitsLiveStateByteBudget} from '@main/live/stateBudget';

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

  it('keeps 200 runs that each hold a maximal 타이머 definition within the budget', () => {
    const runs: Record<TimerId, TimerRuns[TimerId]> = {};
    for (let index = 0; index < MAX_LIVE_TIMERS; index++) {
      const id = createTimerId(
        `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      );
      runs[id] = {
        state: 'paused',
        at: Number.MAX_SAFE_INTEGER,
        countedMs: Number.MAX_SAFE_INTEGER,
        day: Number.MAX_SAFE_INTEGER,
        wallAt: Number.MAX_SAFE_INTEGER,
        completed: true,
        timer: {
          id,
          name: '가'.repeat(TIMER_NAME_LIMIT),
          kind: 'countdownTo',
          time: '23:59',
          date: '2999-12-31',
          overrun: false,
        },
      };
    }
    const state = {...emptyLiveState(), timers: runs};
    expect(fitsLiveStateByteBudget(state)).toBe(true);
    expect(liveStateBytes(state, 'upperBound')).toBeLessThan(
      LIVE_STATE_BYTE_BUDGET,
    );
  });
});
