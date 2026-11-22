import {describe, expect, it} from 'vitest';
import {emptyLiveState} from '@core/schema/live';
import {parseLiveCommand} from '@core/schema/liveCommand';
import {parseLiveState} from '@core/schema/liveState';
import {LIVE_STATE_LIMITS} from '@core/schema/liveLimits';
import {parseRecoveryRecord} from '@core/schema/recoveryRecord';

const uuid = (index: number) =>
  `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
function state(layers: object = {}, fields: object = {}) {
  const empty = emptyLiveState();
  return {...empty, ...fields, layers: {...empty.layers, ...layers}};
}
function record(value: unknown) {
  return parseRecoveryRecord(
    JSON.stringify({
      format: 'llrecovery',
      schemaVersion: 1,
      savedAt: '2026-10-26T00:00:00.000Z',
      serviceId: null,
      state: value,
    }),
  );
}

describe('shared live and recovery limits', () => {
  it('accepts 200 outputs by screen id and rejects one more', () => {
    const outputs = Object.fromEntries(
      Array.from(
        {length: LIVE_STATE_LIMITS.outputs},
        (_, i) => [uuid(i), true] as const,
      ),
    );
    for (const [key, on] of Object.entries(outputs)) {
      expect(parseLiveCommand({type: 'output.set', screenId: key, on}).ok).toBe(
        true,
      );
    }
    expect(parseLiveState(state({}, {outputs})).ok).toBe(true);
    expect(record(state({}, {outputs})).ok).toBe(true);
    const extra = {...outputs, [uuid(999)]: true};
    expect(parseLiveState(state({}, {outputs: extra})).ok).toBe(false);
    expect(record(state({}, {outputs: extra})).ok).toBe(false);
  });

  it.each(['main', 'stage', 'broadcast', 'captions', '', 'not-an-id'])(
    'accepts only screen ids as output keys, not %j',
    key => {
      expect(
        parseLiveCommand({type: 'output.set', screenId: key, on: true}).ok,
      ).toBe(false);
      expect(parseLiveState(state({}, {outputs: {[key]: true}})).ok).toBe(
        false,
      );
      expect(record(state({}, {outputs: {[key]: true}})).ok).toBe(false);
    },
  );
});
