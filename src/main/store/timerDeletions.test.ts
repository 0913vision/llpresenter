import {expect, it, onTestFinished, vi} from 'vitest';
import {
  parseSettingsDocument,
  parseSettingsEdit,
  type SettingsDocument,
  type SettingsName,
} from '@core/schema/settingsDocuments';
import {expectSuccess} from '@core/schema/testHelpers';
import {parseLiveCommand} from '@core/schema/liveCommand';
import {createTimerId} from '@core/schema/ids';
import {recordingLogger} from '../displays/testing';
import {LiveStore} from '../live/store';
import {startOverlays} from '../live/overlays';
import {MAIN, TEXT_STYLE} from '../live/testing/overlays';
import type {DocumentFiles} from './contentPersistence';
import {SettingsStore} from './settingsStore';

const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const TARGET = createTimerId(id(1));
const KEEP = createTimerId(id(2));
const edit = {type: 'timer.delete', name: 'timers', timerId: TARGET};
const linked = {
  id: id(11),
  kind: 'timer',
  ref: TARGET,
  name: 'Delete',
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
    if (name === options.missing) continue;
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
                      id: TARGET,
                      name: 'Delete',
                      future: true,
                      ...(options.kind ?? {kind: 'countdown', duration: 30}),
                    },
                    {id: KEEP, name: 'Keep', kind: 'elapsed', start: 15},
                  ],
                }
              : {items: options.rows ?? [linked]}),
          },
        }),
      ),
    );
  }
  documents.set(
    'props',
    expectSuccess(
      parseSettingsDocument({
        name: 'props',
        revision: 1,
        access: 'editable',
        value: {
          format: 'llsettings.props',
          schemaVersion: 1,
          props: [
            {
              id: id(99),
              name: 'Reference',
              targets: [MAIN],
              content: {
                kind: 'text',
                text: `Deleted {timer:${TARGET}} kept {timer:${KEEP}}`,
                style: TEXT_STYLE,
              },
            },
          ],
        },
      }),
    ),
  );
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
  const save = async (value: unknown = edit) => {
    const result = store.apply(expectSuccess(parseSettingsEdit(value)));
    await vi.advanceTimersByTimeAsync(500);
    return result;
  };
  const timers = () => {
    const d = store.get('timers');
    if (d.name !== 'timers') throw Error('Missing fixture');
    return d;
  };
  const quick = () => {
    const d = store.get('quick');
    if (d.name !== 'quick') throw Error('Missing fixture');
    return d;
  };
  const snapshot = () => Array.from(documents.keys(), name => store.get(name));
  return {store, write, save, timers, quick, snapshot};
}

it.each([
  {kind: 'clock'},
  {kind: 'countdown', duration: 90, overrun: false},
  {kind: 'countdownTo', date: '2028-02-29', time: '12:00'},
  {kind: 'elapsed', start: 0},
  {kind: 'elapsedFrom', time: '09:00'},
])(
  'deletes $kind and all linked known rows before either broadcast, preserving unrelated content',
  async kind => {
    const other = {...linked, id: id(13), ref: KEEP, name: 'Keep row'};
    const future = {...linked, id: id(14), kind: 'future', name: 'Opaque row'};
    const f = fixture({
      kind,
      rows: [linked, {...linked, id: id(12)}, other, future],
    });
    const beforeTimers = f.timers();
    const beforeProps = f.store.get('props');
    const observed: object[] = [];
    f.store.subscribe(() =>
      observed.push({
        timers: f.timers().value.timers.map(t => t.id),
        rows: f.quick().value.items.map(t => t.id),
      }),
    );
    expect(await f.save()).toMatchObject({
      ok: true,
      value: {id: TARGET, revision: 2},
    });
    expect(observed).toEqual(
      Array.from({length: 2}, () => ({timers: [KEEP], rows: [id(13), id(14)]})),
    );
    expect(f.timers().value).toEqual({
      ...beforeTimers.value,
      timers: beforeTimers.value.timers.filter(t => t.id !== TARGET),
    });
    expect(f.quick().value).toMatchObject({
      future: {keep: true},
      items: [other, future],
    });
    expect(f.store.get('props')).toBe(beforeProps);
    expect(f.write).toHaveBeenCalledTimes(2);
  },
);

it('deletes a standalone definition with read-only quick settings and writes only timers', async () => {
  const f = fixture({readOnly: 'quick', rows: []});
  const before = f.quick();
  expect(await f.save()).toMatchObject({ok: true});
  expect(f.timers().value.timers.map(t => t.id)).toEqual([KEEP]);
  expect(f.quick()).toBe(before);
  expect(f.write).toHaveBeenCalledOnce();
});

it.each([
  {readOnly: 'timers'},
  {readOnly: 'quick'},
  {missing: 'timers'},
  {missing: 'quick'},
] as const)(
  'refuses unavailable or unwritable documents without partial deletion: %j',
  async options => {
    const f = fixture(options);
    const before = f.snapshot();
    expect(await f.save()).toMatchObject({ok: false});
    expect(f.snapshot()).toEqual(before);
    expect(f.write).not.toHaveBeenCalled();
  },
);

it('refuses a missing ID and keeps an applied disk warning after removing both records', async () => {
  const f = fixture();
  expect(await f.save({...edit, timerId: id(100)})).toMatchObject({
    ok: false,
    error: {reason: 'not-found'},
  });
  f.write.mockImplementation(async request => ({
    ok: false,
    error: {file: request.target.file, message: 'Fixture disk'},
  }));
  expect(await f.save()).toMatchObject({
    ok: false,
    error: {reason: 'write-failed', applied: {id: TARGET}},
  });
  expect(f.timers().value.timers.map(t => t.id)).toEqual([KEEP]);
  expect(f.quick().value.items).toEqual([]);
});

it('releases the deleted run and stage choice while another run keeps its identity', async () => {
  const f = fixture();
  const live = new LiveStore();
  const stop = startOverlays({
    store: live,
    settings: Promise.resolve(f.store),
    log: recordingLogger(),
  });
  onTestFinished(stop);
  await Promise.resolve();
  live.dispatch(
    expectSuccess(
      parseLiveCommand({
        type: 'live.batch',
        commands: [
          {type: 'timer.start', timerId: TARGET},
          {type: 'timer.start', timerId: KEEP},
          {type: 'stage.timer.set', timerId: TARGET},
        ],
      }),
    ),
  );
  const before = live.state.timers?.[KEEP];
  expect(before).toBeDefined();
  expect(await f.save()).toMatchObject({ok: true});
  expect(live.state.timers?.[TARGET]).toBeUndefined();
  expect(live.state.stageTimerId).toBeUndefined();
  expect(live.state.timers?.[KEEP]).toBe(before);
});
