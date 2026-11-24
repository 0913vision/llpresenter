import {describe, expect, it} from 'vitest';
import {emptyLiveState} from '@core/schema/live/live';
import {createServiceId} from '@core/schema/common/ids';
import {
  MAX_ACTIVE_MESSAGES,
  MAX_ACTIVE_PROPS,
  MAX_TARGET_SCREENS,
} from '@core/schema/live/overlayState';
import {
  parseRecoveryRecord,
  serializeRecoveryRecord,
  RECOVERY_RECORD_LIMITS,
  type RecoveryRecord,
} from '@core/schema/app/recoveryRecord';
import {
  expectFailure,
  expectRoundTrip,
  expectSuccess,
} from '@fixtures/core/schema/testHelpers';

const FILE = 'recovery/live.json';
function uuid(number: number) {
  return `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
}
const savedAt = '2026-10-26T06:00:00+09:00';
const now = Date.parse(savedAt);
const codec = {parse: parseRecoveryRecord, serialize: serializeRecoveryRecord};

function record(): RecoveryRecord {
  return {
    format: 'llrecovery',
    schemaVersion: 1,
    savedAt,
    serviceId: createServiceId(uuid(1)),
    state: emptyLiveState(),
  };
}

function message(index = 1) {
  return {
    messageId: uuid(index),
    text: 'Invented cue',
    targets: 'all',
    excludedTargets: [],
    startedAt: now,
    expiresAt: now + 5000,
  };
}

function prop(index = 1) {
  return {
    propId: uuid(index),
    content: {kind: 'image', media: uuid(2)},
    targets: [uuid(3)],
  };
}

function stateWith(layers: object = {}, fields: object = {}) {
  const empty = emptyLiveState();
  return {...empty, ...fields, layers: {...empty.layers, ...layers}};
}

function readState(state: unknown) {
  return parseRecoveryRecord(JSON.stringify({...record(), state}), FILE);
}

describe('recovery record files', () => {
  it('keeps an unknown field of the saved state', () => {
    expectRoundTrip(codec, {
      ...record(),
      state: stateWith({}, {laterField: uuid(4)}),
    });
  });
  it('round trips a current record, null service, BOM, and stable JSON', () => {
    expectRoundTrip(codec, record());
    expectRoundTrip(codec, {...record(), serviceId: null});
    const text = expectSuccess(serializeRecoveryRecord(record(), FILE));
    expect(text.endsWith('\n')).toBe(true);
    expect(
      expectSuccess(parseRecoveryRecord(`\uFEFF${text}`, FILE)),
    ).toMatchObject({access: 'editable', sourceVersion: 1, dropped: []});
    expect(
      expectSuccess(
        serializeRecoveryRecord(expectSuccess(parseRecoveryRecord(text)).data),
      ),
    ).toBe(text);
  });

  it('keeps a newer compatible record read-only and refuses to serialize it', () => {
    const future = {...record(), schemaVersion: 2, future: 'kept'};
    const loaded = expectSuccess(
      parseRecoveryRecord(JSON.stringify(future), FILE),
    );
    expect(loaded).toMatchObject({
      access: 'readOnly',
      sourceVersion: 2,
      data: future,
    });
    expect(
      expectFailure(serializeRecoveryRecord(loaded.data, FILE)),
    ).toMatchObject({kind: 'newer', field: 'schemaVersion', file: FILE});
    expect(
      expectFailure(
        parseRecoveryRecord(JSON.stringify({...future, state: {}}), FILE),
      ).kind,
    ).toBe('newer');
  });

  it('returns typed errors for JSON, missing wrappers, and invalid writes', () => {
    expect(expectFailure(parseRecoveryRecord('{', FILE))).toMatchObject({
      kind: 'json',
      file: FILE,
    });
    for (const value of [
      null,
      [],
      {},
      {format: 'llrecovery', schemaVersion: 1},
    ]) {
      expect(parseRecoveryRecord(JSON.stringify(value)).ok).toBe(false);
    }
    expect(
      expectFailure(
        serializeRecoveryRecord({...record(), savedAt: 'bad'}, FILE),
      ),
    ).toMatchObject({kind: 'invalid', field: 'savedAt', file: FILE});
  });

  it('caps UTF-8 bytes on both read and write, including unknown content', () => {
    const oversized = {
      ...record(),
      futureText: '가'.repeat(Math.floor(RECOVERY_RECORD_LIMITS.bytes / 3)),
    };
    const text = JSON.stringify(oversized);
    expect(text.length).toBeLessThan(RECOVERY_RECORD_LIMITS.bytes);
    expect(expectFailure(parseRecoveryRecord(text, FILE))).toMatchObject({
      kind: 'invalid',
      file: FILE,
      field: '',
    });
    expect(
      expectFailure(serializeRecoveryRecord(oversized, FILE)),
    ).toMatchObject({kind: 'invalid', file: FILE, field: ''});
    expect(
      parseRecoveryRecord(' '.repeat(RECOVERY_RECORD_LIMITS.bytes + 1)).ok,
    ).toBe(false);
  });

  it('applies existing overlay list limits to saved live state', () => {
    const invalid = [
      stateWith({
        message: {
          messageId: 'legacy',
          text: '',
          items: Array.from({length: MAX_ACTIVE_MESSAGES + 1}, (_, i) =>
            message(i),
          ),
        },
      }),
      stateWith({
        prop: {
          propId: 'legacy',
          items: Array.from({length: MAX_ACTIVE_PROPS + 1}, (_, i) => prop(i)),
        },
      }),
      stateWith({
        prop: {
          propId: 'legacy',
          items: [
            {
              ...prop(),
              targets: Array.from({length: MAX_TARGET_SCREENS + 1}, (_, i) =>
                uuid(i),
              ),
            },
          ],
        },
      }),
    ];
    for (const state of invalid) expect(readState(state).ok).toBe(false);
  });
});
