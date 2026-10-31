import {expect, it, onTestFinished, vi} from 'vitest';
import {
  parseSettingsDocument,
  parseSettingsEdit,
  type SettingsDocument,
  type SettingsName,
} from '@core/schema/settingsDocuments';
import {expectSuccess} from '@core/schema/testHelpers';
import {recordingLogger} from '../displays/testing';
import type {DocumentFiles} from './contentPersistence';
import {SettingsStore} from './settingsStore';

const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const rename = {
  type: 'timer.rename',
  name: 'timers',
  timerId: id(1),
  timerName: '설교',
};
const linked = {
  id: id(11),
  kind: 'timer',
  ref: id(1),
  name: '기존',
  future: true,
};

function fixture(
  options: {
    readonly kind?: Readonly<Record<string, unknown>>;
    readonly rows?: readonly object[];
    readonly readOnly?: 'quick' | 'timers';
    readonly missing?: 'quick' | 'timers';
  } = {},
) {
  vi.useFakeTimers();
  const documents = new Map<SettingsName, SettingsDocument>();
  for (const name of ['timers', 'quick'] as const) {
    if (options.missing === name) continue;
    documents.set(
      name,
      expectSuccess(
        parseSettingsDocument({
          name,
          revision: 1,
          access: name === options.readOnly ? 'readOnly' : 'editable',
          value: {
            format: `llsettings.${name}`,
            schemaVersion: 1,
            future: {keep: true},
            ...(name === 'timers'
              ? {
                  timers: [
                    {
                      id: id(1),
                      name: '기존',
                      future: true,
                      ...(options.kind ?? {kind: 'clock'}),
                    },
                    {
                      id: id(2),
                      name: '다른 타이머',
                      kind: 'countdown',
                      duration: 90,
                    },
                  ],
                }
              : {items: options.rows ?? [linked]}),
          },
        }),
      ),
    );
  }
  const write = vi
    .fn<DocumentFiles['write']>()
    .mockResolvedValue({ok: true, value: undefined});
  const store = new SettingsStore({
    documents,
    problems: [],
    log: recordingLogger(),
    saving: {
      folder: '/settings',
      files: {write, remove: async () => ({ok: true, value: undefined})},
    },
  });
  onTestFinished(async () => {
    await store.dispose();
    vi.useRealTimers();
  });
  const save = async (value: unknown = rename) => {
    const result = store.apply(expectSuccess(parseSettingsEdit(value)));
    await vi.advanceTimersByTimeAsync(500);
    return result;
  };
  const timerNames = () => {
    const d = store.get('timers');
    if (d.name !== 'timers') throw Error('Missing timers');
    return d.value.timers.map(t => t.name);
  };
  const quickNames = () => {
    const d = store.get('quick');
    if (d.name !== 'quick') throw Error('Missing quick');
    return d.value.items.map(t => t.name);
  };
  const snapshot = () => Array.from(documents.keys(), name => store.get(name));
  return {store, write, save, timerNames, quickNames, snapshot};
}

it.each([
  {kind: 'clock'},
  {kind: 'countdown', duration: 90, overrun: false},
  {kind: 'countdownTo', time: '12:00', date: '2028-02-29', overrun: true},
  {kind: 'elapsed', start: 15},
  {kind: 'elapsedFrom', time: '09:00'},
])(
  'renames $kind and every linked quick row before either broadcast',
  async kind => {
    const f = fixture({
      kind,
      rows: [
        linked,
        {...linked, id: id(12)},
        {...linked, id: id(13), ref: id(2), name: '다른 행'},
        {...linked, id: id(14), kind: 'future', name: '미래 행'},
      ],
    });
    const before = f.store.get('timers');
    const observed: object[] = [];
    f.store.subscribe(() =>
      observed.push({timers: f.timerNames(), quick: f.quickNames()}),
    );
    expect(await f.save()).toMatchObject({
      ok: true,
      value: {id: id(1), revision: 2},
    });
    expect(observed).toEqual(
      Array.from({length: 2}, () => ({
        timers: ['설교', '다른 타이머'],
        quick: ['설교', '설교', '다른 행', '미래 행'],
      })),
    );
    const document = f.store.get('timers');
    if (document.name !== 'timers' || before.name !== 'timers') {
      throw Error('Missing timer fixture');
    }
    expect(document.value).toEqual({
      ...before.value,
      timers: [
        {...before.value.timers[0], name: '설교'},
        before.value.timers[1],
      ],
    });
    expect(f.store.get('quick').value).toMatchObject({
      future: {keep: true},
      items: [
        {...linked, name: '설교'},
        {...linked, id: id(12), name: '설교'},
        {...linked, id: id(13), ref: id(2), name: '다른 행'},
        {...linked, id: id(14), kind: 'future', name: '미래 행'},
      ],
    });
    expect(await f.save()).toMatchObject({ok: true});
    expect(f.write).toHaveBeenCalledTimes(2);
  },
);

it('allows standalone renaming with read-only quick settings when no quick name changes', async () => {
  const f = fixture({readOnly: 'quick', rows: []});
  expect(await f.save()).toMatchObject({ok: true});
  expect(f.timerNames()[0]).toBe('설교');
  expect(f.write).toHaveBeenCalledOnce();
});

it.each([
  {readOnly: 'quick'},
  {readOnly: 'timers'},
  {missing: 'quick'},
  {missing: 'timers'},
] as const)(
  'refuses unavailable or unwritable paired names without partial changes: %j',
  async options => {
    const f = fixture(options);
    const before = f.snapshot();
    expect(await f.save()).toMatchObject({ok: false});
    expect(f.snapshot()).toEqual(before);
    expect(f.write).not.toHaveBeenCalled();
  },
);

it('refuses a missing timer and reports a disk warning after applying both names', async () => {
  const f = fixture();
  expect(await f.save({...rename, timerId: id(99)})).toMatchObject({
    ok: false,
    error: {reason: 'not-found'},
  });
  f.write.mockResolvedValue({
    ok: false,
    error: {file: '/settings/timers.json', message: 'Fixture disk'},
  });
  expect(await f.save()).toMatchObject({
    ok: false,
    error: {reason: 'write-failed', applied: {id: id(1)}},
  });
  expect(f.timerNames()[0]).toBe('설교');
  expect(f.quickNames()[0]).toBe('설교');
});

it('retries queued files for an already-applied timer name and waits for durability', async () => {
  const f = fixture();
  f.write.mockImplementation(async request => ({
    ok: false,
    error: {file: request.target.file, message: 'Invented disk failure'},
  }));
  expect(await f.save()).toMatchObject({
    ok: false,
    error: {reason: 'write-failed'},
  });
  const before = f.snapshot();
  const firstWrites = f.write.mock.calls.length;
  expect(await f.save()).toMatchObject({
    ok: false,
    error: {reason: 'write-failed'},
  });
  expect(f.write.mock.calls.length).toBe(firstWrites + 2);
  f.write.mockResolvedValue({ok: true, value: undefined});
  expect(await f.save()).toMatchObject({ok: true});
  expect(f.write.mock.calls.length).toBe(firstWrites + 4);
  expect(f.snapshot()).toEqual(before);
});
