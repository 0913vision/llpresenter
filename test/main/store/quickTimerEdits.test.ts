import {describe, expect, it} from 'vitest';
import {
  parseSettingsDocument,
  parseSettingsEdit,
  type SettingsDocument,
  type SettingsName,
} from '@core/schema/settingsDocuments';
import {MAX_TIMER_DEFINITIONS} from '@core/schema/quickTimerEdit';
import {MAX_QUICK_ITEMS} from '@core/schema/quick';
import {expectSuccess} from '@fixtures/core/schema/testHelpers';
import {prepareQuickTimerEdit} from '@main/store/quickTimerEdits';

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

/** Applies each prepared edit to the documents, as the settings store would. */
function setup(options: FixtureOptions = {}) {
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
  let written = 0;
  const quick = () => {
    const d = documents.get('quick');
    if (d?.name !== 'quick') throw new Error('Missing quick fixture');
    return d;
  };
  const timers = () => {
    const d = documents.get('timers');
    if (d?.name !== 'timers') throw new Error('Missing timer fixture');
    return d;
  };
  const save = async (value: unknown) => {
    const edit = expectSuccess(parseSettingsEdit(value));
    if (
      edit.type !== 'quick.timer.create' &&
      edit.type !== 'quick.timer.rename'
    ) {
      throw new Error('Not a quick timer edit');
    }
    const result = prepareQuickTimerEdit(documents, edit);
    if (!result.ok) return result;
    for (const document of result.value.documents) {
      documents.set(document.name, document);
    }
    written += result.value.documents.length;
    return {ok: true, value: result.value.applied};
  };
  return {quick, timers, save, written: () => written};
}

describe('paired quick timer edits', () => {
  it.each([true, false])(
    'persists overrun %s and only replays the same timer configuration',
    async overrun => {
      const f = setup();
      expect(await f.save({...create(), overrun})).toMatchObject({ok: true});
      expect(f.timers().value.timers[0]).toMatchObject({overrun});
      expect(await f.save({...create(), overrun})).toMatchObject({ok: true});
      expect(await f.save({...create(), overrun: !overrun})).toMatchObject({
        ok: false,
        error: {reason: 'invalid'},
      });
      expect(f.quick().value.items).toHaveLength(1);
      expect(f.timers().value.timers).toHaveLength(1);
      expect(f.written()).toBe(2);
    },
  );

  it('treats omitted and explicit continue as the same configuration on retry', async () => {
    const f = setup();
    expect(await f.save(create())).toMatchObject({ok: true});
    expect(await f.save({...create(), overrun: true})).toMatchObject({
      ok: true,
    });
    expect(f.quick().value.items).toHaveLength(1);
    expect(f.written()).toBe(2);
  });
  it('creates distinct numbered countdowns', async () => {
    const f = setup();
    expect(await f.save(create())).toEqual({
      ok: true,
      value: {id: id(1), revision: 2},
    });
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
    expect(f.written()).toBe(4);
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
    expect(await f.save(rename)).toMatchObject({ok: true});
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
  });

  it('makes a repeated create idempotent even after a rename and does not write a redundant rename', async () => {
    const f = setup();
    await f.save(create());
    await f.save(rename);
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
    expect(f.written()).toBe(4);
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
      expect(f.written()).toBe(0);
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
      expect(f.written()).toBe(0);
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
    expect(f.written()).toBe(2);
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
      expect(f.written()).toBe(0);
    },
  );

  it('refuses a rename of a missing timer row', async () => {
    const f = setup();
    expect(await f.save(rename)).toMatchObject({
      ok: false,
      error: {reason: 'not-found'},
    });
  });
});
