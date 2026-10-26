import {join} from 'node:path';
import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {
  parseSettingsDocument,
  parseSettingsEdit,
  type SettingsDocument,
  type SettingsName,
} from '@shared/schema/settingsDocuments';
import {MAX_TIMER_DEFINITIONS} from '@shared/schema/quickTimerEdit';
import {MAX_QUICK_ITEMS} from '@shared/schema/quick';
import {expectSuccess} from '@shared/schema/testHelpers';
import {recordingLogger} from '../displays/testing';
import type {DocumentFiles} from './contentPersistence';
import {SettingsStore} from './settingsStore';

const id = (n: number): string =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const create = (n = 1) => ({
  type: 'quick.timer.create',
  name: 'quick',
  quickItemId: id(n),
  timerId: id(n + 100),
  duration: 90,
});
const rename = {
  type: 'quick.timer.rename',
  name: 'quick',
  quickItemId: id(1),
  timerName: '설교',
};

interface FixtureOptions {
  readonly quickItems?: ReadonlyArray<Readonly<Record<string, unknown>>>;
  readonly timerItems?: ReadonlyArray<Readonly<Record<string, unknown>>>;
  readonly readOnly?: 'quick' | 'timers';
  readonly missing?: 'quick' | 'timers';
}

function setup(options: FixtureOptions = {}) {
  vi.useFakeTimers();
  const documents = new Map<SettingsName, SettingsDocument>();
  for (const name of ['quick', 'timers'] as const) {
    if (name === options.missing) continue;
    documents.set(
      name,
      expectSuccess(
        parseSettingsDocument({
          name,
          revision: 1,
          access: options.readOnly === name ? 'readOnly' : 'editable',
          value: {
            format: `llsettings.${name}`,
            schemaVersion: 1,
            future: {kept: name},
            ...(name === 'quick'
              ? {items: options.quickItems ?? []}
              : {timers: options.timerItems ?? []}),
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
  const quick = () => {
    const d = store.get('quick');
    if (d.name !== 'quick') throw new Error('Missing quick fixture');
    return d;
  };
  const timers = () => {
    const d = store.get('timers');
    if (d.name !== 'timers') throw new Error('Missing timer fixture');
    return d;
  };
  const save = async (edit: unknown) => {
    const pending = store.apply(expectSuccess(parseSettingsEdit(edit)));
    await vi.advanceTimersByTimeAsync(500);
    return pending;
  };
  return {store, write, quick, timers, save};
}

describe('paired quick timer edits', () => {
  it('separates legacy shared references once, preserving the first ID, row order and unknown fields', async () => {
    const f = setup({
      quickItems: [1, 2, 3].map(n => ({
        id: id(n),
        kind: 'timer',
        ref: id(101),
        name: `타이머 ${n}`,
        extra: {row: n},
      })),
      timerItems: [
        {
          id: id(101),
          kind: 'countdown',
          name: '원래 타이머',
          duration: 90,
          extra: {definition: true},
        },
        {id: id(999), kind: 'clock', name: '다른 타이머'},
      ],
    });
    const separate = {type: 'quick.timers.separate', name: 'quick'};
    expect(await f.save(separate)).toMatchObject({ok: true});
    const refs = f
      .quick()
      .value.items.map(item => ('ref' in item ? item.ref : null));
    expect(refs[0]).toBe(id(101));
    expect(new Set(refs).size).toBe(3);
    expect(f.quick().value.items.map(item => item.id)).toEqual([
      id(1),
      id(2),
      id(3),
    ]);
    expect(f.quick().value.items[1]).toMatchObject({
      name: '타이머 2',
      extra: {row: 2},
    });
    expect(f.timers().value.timers).toHaveLength(4);
    expect(f.timers().value.timers[0]).toMatchObject({
      id: id(101),
      name: '원래 타이머',
    });
    expect(f.timers().value.timers[1]).toMatchObject({id: id(999)});
    expect(f.timers().value.timers[2]).toMatchObject({
      id: refs[1],
      name: '타이머 2',
      duration: 90,
      extra: {definition: true},
    });
    expect(await f.save(separate)).toEqual({
      ok: true,
      value: {id: 'quick', revision: 2},
    });
    expect(f.write).toHaveBeenCalledTimes(2);
  });

  it('refuses legacy separation at the definition cap without dropping a row or changing its reference', async () => {
    const f = setup({
      quickItems: [1, 2].map(n => ({
        id: id(n),
        kind: 'timer',
        ref: id(101),
        name: '공유',
      })),
      timerItems: Array.from({length: MAX_TIMER_DEFINITIONS}, (_, n) => ({
        id: n === 0 ? id(101) : id(n + 1000),
        kind: 'clock',
        name: '시계',
      })),
    });
    expect(
      await f.save({type: 'quick.timers.separate', name: 'quick'}),
    ).toMatchObject({ok: false, error: {reason: 'invalid'}});
    expect(f.quick().revision).toBe(1);
    expect(f.timers().revision).toBe(1);
    expect(f.write).not.toHaveBeenCalled();
  });
  it('creates distinct numbered countdowns and publishes only after both documents are installed', async () => {
    const f = setup();
    const observed: string[][] = [];
    f.store.subscribe(() =>
      observed.push([
        f.quick().value.items.at(-1)?.id ?? '',
        f.timers().value.timers.at(-1)?.id ?? '',
      ]),
    );
    const first = f.store.apply(expectSuccess(parseSettingsEdit(create())));
    expect(observed).toEqual([
      [id(1), id(101)],
      [id(1), id(101)],
    ]);
    expect(f.write).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(500);
    expect(await first).toEqual({ok: true, value: {id: id(1), revision: 2}});
    expect(await f.save(create(2))).toMatchObject({ok: true});
    expect(f.timers().value.timers).toEqual([
      {id: id(101), name: '타이머 1', kind: 'countdown', duration: 90},
      {id: id(102), name: '타이머 2', kind: 'countdown', duration: 90},
    ]);
    expect(f.quick().value.items.map(item => item.name)).toEqual([
      '타이머 1',
      '타이머 2',
    ]);
    expect(
      f.quick().value.items.map(item => ('ref' in item ? item.ref : null)),
    ).toEqual([id(101), id(102)]);
    expect(f.write).toHaveBeenCalledTimes(4);
  });

  it('keeps unknown fields and renames the definition and quick row together without changing IDs', async () => {
    const f = setup({
      quickItems: [
        {
          id: id(1),
          kind: 'timer',
          ref: id(101),
          name: '타이머 1',
          extra: {row: true},
        },
        {id: id(2), kind: 'future', name: '미래 항목', extra: true},
      ],
      timerItems: [
        {
          id: id(101),
          kind: 'countdown',
          name: '타이머 1',
          duration: 90,
          extra: {timer: true},
        },
        {id: id(102), kind: 'clock', name: '시계'},
      ],
    });
    const listener = vi.fn(() => {
      expect(f.quick().value.items[0]?.name).toBe('설교');
      expect(f.timers().value.timers[0]?.name).toBe('설교');
    });
    f.store.subscribe(listener);
    expect(await f.save(rename)).toMatchObject({ok: true});
    expect(listener).toHaveBeenCalledTimes(2);
    expect(f.quick().value).toMatchObject({
      future: {kept: 'quick'},
      items: [
        {id: id(1), ref: id(101), name: '설교', extra: {row: true}},
        {kind: 'future', extra: true},
      ],
    });
    expect(f.timers().value).toMatchObject({
      future: {kept: 'timers'},
      timers: [
        {id: id(101), name: '설교', duration: 90, extra: {timer: true}},
        {id: id(102), name: '시계'},
      ],
    });
    expect(
      f.write.mock.calls.map(([request]): unknown => JSON.parse(request.text)),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({format: 'llsettings.quick'}),
        expect.objectContaining({format: 'llsettings.timers'}),
      ]),
    );
  });

  it('makes a repeated create idempotent even after a rename and does not write a redundant rename', async () => {
    const f = setup();
    await f.save(create());
    await f.save(rename);
    const listener = vi.fn();
    f.store.subscribe(listener);
    expect(await f.save(create())).toEqual({
      ok: true,
      value: {id: id(1), revision: 3},
    });
    expect(await f.save(rename)).toEqual({
      ok: true,
      value: {id: id(1), revision: 3},
    });
    expect(f.quick().value.items).toHaveLength(1);
    expect(f.timers().value.timers[0]?.name).toBe('설교');
    expect(f.write).toHaveBeenCalledTimes(4);
    expect(listener).not.toHaveBeenCalled();
  });

  it('uses an unused numbered name across definitions and existing quick rows', async () => {
    const f = setup({
      timerItems: [{id: id(200), kind: 'clock', name: '타이머 1'}],
      quickItems: [
        {id: id(300), kind: 'timer', ref: id(200), name: '타이머 2'},
      ],
    });
    await f.save(create());
    expect(f.timers().value.timers.at(-1)?.name).toBe('타이머 3');
  });

  it.each(['quick', 'timers'] as const)(
    'refuses a pair when %s is read-only',
    async name => {
      const f = setup({readOnly: name});
      expect(await f.save(create())).toMatchObject({
        ok: false,
        error: {reason: 'read-only'},
      });
      expect(f.quick().revision).toBe(1);
      expect(f.timers().revision).toBe(1);
      expect(f.write).not.toHaveBeenCalled();
    },
  );

  it.each(['quick', 'timers'] as const)(
    'refuses creation when %s did not load',
    async name => {
      const f = setup({missing: name});
      expect(await f.save(create())).toMatchObject({
        ok: false,
        error: {reason: 'not-found'},
      });
      expect(f.write).not.toHaveBeenCalled();
    },
  );

  it.each([
    {quickItemId: id(1), timerId: id(102)},
    {quickItemId: id(2), timerId: id(101)},
    {quickItemId: id(2), timerId: id(1)},
    {quickItemId: id(101), timerId: id(102)},
    {duration: 91},
  ])('refuses colliding IDs or a different replay payload', async change => {
    const f = setup();
    await f.save(create());
    expect(await f.save({...create(), ...change})).toMatchObject({
      ok: false,
      error: {reason: 'invalid'},
    });
    expect(f.quick().revision).toBe(2);
    expect(f.timers().revision).toBe(2);
    expect(f.write).toHaveBeenCalledTimes(2);
  });

  it.each(['quick', 'timers'] as const)(
    'refuses additions at the %s cap before changing either file',
    async area => {
      const f = setup({
        quickItems:
          area === 'quick'
            ? Array.from({length: MAX_QUICK_ITEMS}, (_, n) => ({
                id: id(n + 1000),
                name: '검은 화면',
                kind: 'black',
              }))
            : [],
        timerItems:
          area === 'timers'
            ? Array.from({length: MAX_TIMER_DEFINITIONS}, (_, n) => ({
                id: id(n + 2000),
                name: '시계',
                kind: 'clock',
              }))
            : [],
      });
      expect(await f.save(create())).toMatchObject({
        ok: false,
        error: {reason: 'invalid'},
      });
      expect(f.quick().revision).toBe(1);
      expect(f.timers().revision).toBe(1);
      expect(f.write).not.toHaveBeenCalled();
    },
  );

  it('keeps a failed pair applied, reports the failed file and flushes its retry', async () => {
    const f = setup();
    const file = join('/settings', 'timers.json');
    f.write.mockImplementation(async request =>
      request.target.file === file
        ? {ok: false, error: {file, message: 'Invented write failure'}}
        : {ok: true, value: undefined},
    );
    expect(await f.save(create())).toEqual({
      ok: false,
      error: {
        reason: 'write-failed',
        message: 'Invented write failure',
        applied: {id: id(1), revision: 2},
        unchangedFiles: [file],
      },
    });
    expect(f.quick().value.items).toHaveLength(1);
    expect(f.timers().value.timers).toHaveLength(1);
    expect(await f.save(create())).toMatchObject({ok: true});
    expect(f.write).toHaveBeenCalledTimes(2);
    f.write.mockResolvedValue({ok: true, value: undefined});
    await f.store.flush();
    expect(f.write).toHaveBeenCalledTimes(3);
    expect(f.write.mock.calls[2]?.[0].target.file).toBe(file);
  });

  it('rejects a legacy shared rename until the rows have distinct definitions', async () => {
    const f = setup({
      quickItems: [1, 2].map(n => ({
        id: id(n),
        name: '공유',
        kind: 'timer',
        ref: id(101),
      })),
      timerItems: [
        {id: id(101), name: '공유', kind: 'countdown', duration: 90},
      ],
    });
    expect(await f.save(rename)).toMatchObject({
      ok: false,
      error: {reason: 'invalid'},
    });
    expect(f.quick().revision).toBe(1);
    expect(f.timers().revision).toBe(1);
  });

  it('refuses missing timer targets and writes after disposal', async () => {
    const f = setup();
    expect(await f.save(rename)).toMatchObject({
      ok: false,
      error: {reason: 'not-found'},
    });
    await f.store.dispose();
    expect(await f.save(create())).toMatchObject({
      ok: false,
      error: {reason: 'not-found'},
    });
    expect(f.write).not.toHaveBeenCalled();
  });
});
