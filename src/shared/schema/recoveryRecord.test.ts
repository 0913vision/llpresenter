import {describe, expect, it} from 'vitest';
import {emptyLiveState} from '../live';
import {createServiceId} from './ids';
import {parseLiveState} from './liveState';
import {
  MAX_ACTIVE_MESSAGES,
  MAX_ACTIVE_PROPS,
  MAX_NOTICE_IMAGES,
  MAX_TARGET_SCREENS,
} from './overlayState';
import {
  parseRecoveryRecord,
  serializeRecoveryRecord,
  RECOVERY_RECORD_LIMITS,
  type RecoveryRecord,
} from './recoveryRecord';
import {expectFailure, expectRoundTrip, expectSuccess} from './testHelpers';

const FILE = 'recovery/live.json';
const uuid = (number: number) =>
  `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
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

function playback() {
  return {
    media: [uuid(2)],
    position: 0,
    interval: 5,
    loop: true,
    targets: [uuid(3)],
    startedAt: now,
    pausedAt: null,
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

  it('accepts a version-one record from before multi-item overlays and stage messages', () => {
    const legacy = {
      ...record(),
      state: stateWith(
        {
          media: {mediaId: 'legacy-media', loop: false, startedAt: now},
          slide: {
            itemId: 'legacy-item',
            position: 2,
            label: null,
            lines: ['Invented legacy slide'],
          },
          prop: {propId: 'legacy-prop'},
          message: {messageId: 'legacy-message', text: 'Invented legacy cue'},
          notice: {noticeId: 'legacy-notice'},
        },
        {outputs: {main: true, stage: false}},
      ),
    };
    expectRoundTrip(codec, legacy);
    const loaded = expectSuccess(parseRecoveryRecord(JSON.stringify(legacy)));
    expect(loaded.sourceVersion).toBe(1);
    expect(loaded.data.state).not.toHaveProperty('stageMessage');
    expect(parseLiveState(loaded.data.state).ok).toBe(true);
  });

  it('keeps unknown fields at every level including overlay arrays and reserved keys', () => {
    const future = {
      ['__proto__']: {safe: true},
      constructor: 'future',
      prototype: [1],
      '\u0000extra': 2,
    };
    const original = {
      ...record(),
      ...future,
      futureRoot: 'kept',
      state: stateWith(
        {
          slide: {
            itemId: 'item',
            position: 0,
            label: 'Verse',
            lines: ['Invented line'],
            ...future,
          },
          media: {mediaId: 'media', loop: true, startedAt: now, ...future},
          message: {
            messageId: 'legacy',
            text: '',
            items: [{...message(), ...future}],
            ...future,
          },
          prop: {
            propId: 'legacy',
            items: [
              {
                ...prop(),
                content: {kind: 'image', media: uuid(2), ...future},
                ...future,
              },
            ],
            ...future,
          },
          notice: {
            noticeId: 'legacy',
            playback: {...playback(), ...future},
            ...future,
          },
          ...future,
        },
        {...future, futureState: {enabled: true}},
      ),
    };
    expectRoundTrip(codec, original);
    const loaded = expectSuccess(
      parseRecoveryRecord(JSON.stringify(original)),
    ).data;
    const changed = {
      ...loaded,
      savedAt: '2026-10-26T06:00:01+09:00',
      state: {...loaded.state, version: 1},
    };
    const output: unknown = JSON.parse(
      expectSuccess(serializeRecoveryRecord(changed)),
    );
    expect(output).toEqual({
      ...original,
      savedAt: changed.savedAt,
      state: {...original.state, version: 1},
    });
    expect({}).not.toHaveProperty('safe');
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

  it.each([
    [{format: 'other'}, 'format', 'format'],
    [{schemaVersion: 0}, 'invalid', 'schemaVersion'],
    [{savedAt: 'not-a-time'}, 'invalid', 'savedAt'],
    [{serviceId: 'invalid'}, 'invalid', 'serviceId'],
    [{state: null}, 'invalid', 'state'],
    [{state: stateWith({}, {version: -1})}, 'invalid', 'state.version'],
    [
      {state: stateWith({}, {outputs: {main: 'on'}})},
      'invalid',
      'state.outputs.main',
    ],
    [
      {
        state: stateWith({
          slide: {itemId: 'item', position: 0, label: null, lines: [1]},
        }),
      },
      'invalid',
      'state.layers.slide.lines.0',
    ],
    [
      {
        state: stateWith({
          message: {
            messageId: 'legacy',
            text: '',
            items: [{...message(), expiresAt: now - 1}],
          },
        }),
      },
      'invalid',
      'state.layers.message.items.0.expiresAt',
    ],
    [
      {
        state: stateWith({
          notice: {noticeId: 'legacy', playback: {...playback(), position: 1}},
        }),
      },
      'invalid',
      'state.layers.notice.playback.position',
    ],
  ])(
    'rejects invalid file content %# with a path and file name',
    (change, kind, field) => {
      expect(
        expectFailure(
          parseRecoveryRecord(JSON.stringify({...record(), ...change}), FILE),
        ),
      ).toMatchObject({kind, field, file: FILE});
    },
  );

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

  it('caps saved outputs, slide lines, and each saved text field', () => {
    const lines = Array.from(
      {length: RECOVERY_RECORD_LIMITS.slideLines},
      () => 'Invented',
    );
    const slide = {itemId: 'item', position: 0, label: null, lines};
    const outputs = Object.fromEntries(
      Array.from({length: RECOVERY_RECORD_LIMITS.outputs}, (_, i) => [
        `screen-${i}`,
        true,
      ]),
    );
    expect(readState(stateWith({slide}, {outputs})).ok).toBe(true);
    expect(
      expectFailure(
        readState(stateWith({}, {outputs: {...outputs, extra: true}})),
      ).field,
    ).toBe('state.outputs');
    expect(
      expectFailure(
        readState(stateWith({slide: {...slide, lines: [...lines, 'Extra']}})),
      ).field,
    ).toBe('state.layers.slide');
    const long = 'x'.repeat(RECOVERY_RECORD_LIMITS.textCharacters + 1);
    const states = [
      stateWith({}, {stageMessage: long}),
      stateWith({slide: {...slide, label: long}}),
      stateWith({slide: {...slide, lines: [long]}}),
      stateWith({message: {messageId: 'legacy', text: long}}),
      stateWith({
        message: {
          messageId: 'legacy',
          text: '',
          items: [{...message(), text: long}],
        },
      }),
      stateWith({
        prop: {
          propId: 'legacy',
          items: [
            {
              ...prop(),
              content: {
                kind: 'text',
                text: long,
                style: {
                  font: 'Pretendard',
                  weight: 600,
                  color: '#FFFFFF',
                  size: 64,
                  lineHeight: 1.2,
                  align: 'center',
                  vAlign: 'bottom',
                  maxLines: 1,
                  margin: 4,
                  shadow: true,
                  outline: false,
                },
              },
            },
          ],
        },
      }),
    ];
    for (const state of states) {
      expect(expectFailure(readState(state)).field).toBe('state');
    }
    expect(readState(stateWith({}, {stageMessage: long.slice(1)})).ok).toBe(
      true,
    );
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
        notice: {
          noticeId: 'legacy',
          playback: {
            ...playback(),
            media: Array.from({length: MAX_NOTICE_IMAGES + 1}, () => uuid(2)),
          },
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
