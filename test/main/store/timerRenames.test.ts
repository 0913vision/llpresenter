import {expect, it} from 'vitest';
import {
  parseSettingsDocument,
  parseSettingsEdit,
  type SettingsDocument,
  type SettingsName,
} from '@core/schema/settingsDocuments';
import {expectSuccess} from '@fixtures/core/schema/testHelpers';
import {prepareTimerRename} from '@main/store/timerRenames';

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

function documentsOf(
  options: {
    readonly kind?: Readonly<Record<string, unknown>>;
    readonly rows?: readonly object[];
    readonly readOnly?: 'quick' | 'timers';
    readonly missing?: 'quick' | 'timers';
  } = {},
) {
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
  return documents;
}

function prepare(
  documents: ReadonlyMap<SettingsName, SettingsDocument>,
  value: object = rename,
) {
  const edit = expectSuccess(parseSettingsEdit(value));
  if (edit.type !== 'timer.rename') throw new Error('Not a timer rename');
  return prepareTimerRename(documents, edit);
}

it.each([
  {kind: 'clock'},
  {kind: 'countdown', duration: 90, overrun: false},
  {kind: 'countdownTo', time: '12:00', date: '2028-02-29', overrun: true},
  {kind: 'elapsed', start: 15},
  {kind: 'elapsedFrom', time: '09:00'},
])('renames $kind and every linked quick row in new revisions', kind => {
  const documents = documentsOf({
    kind,
    rows: [
      linked,
      {...linked, id: id(12)},
      {...linked, id: id(13), ref: id(2), name: '다른 행'},
      {...linked, id: id(14), kind: 'future', name: '미래 행'},
    ],
  });
  const before = documents.get('timers');

  const result = expectSuccess(prepare(documents));

  expect(result.applied).toEqual({id: id(1), revision: 2});
  const [timers, quick] = result.documents;
  if (timers?.name !== 'timers' || before?.name !== 'timers') {
    throw Error('Missing timer documents');
  }
  expect(timers).toMatchObject({revision: 2});
  expect(timers.value).toEqual({
    ...before.value,
    timers: [{...before.value.timers[0], name: '설교'}, before.value.timers[1]],
  });
  expect(quick).toMatchObject({
    name: 'quick',
    revision: 2,
    value: {
      future: {keep: true},
      items: [
        {...linked, name: '설교'},
        {...linked, id: id(12), name: '설교'},
        {...linked, id: id(13), ref: id(2), name: '다른 행'},
        {...linked, id: id(14), kind: 'future', name: '미래 행'},
      ],
    },
  });
});

it('changes nothing when the timer and its rows already have the name', () => {
  const documents = documentsOf({rows: [{...linked, name: '설교'}]});
  const renamed = expectSuccess(prepare(documents));
  for (const document of renamed.documents) {
    documents.set(document.name, document);
  }

  expect(expectSuccess(prepare(documents)).documents).toEqual([]);
});

it('renames a timer alone when the read-only quick settings have no linked row', () => {
  const result = expectSuccess(
    prepare(documentsOf({readOnly: 'quick', rows: []})),
  );

  expect(result.documents.map(document => document.name)).toEqual(['timers']);
});

it.each([
  [{readOnly: 'quick'}, 'read-only'],
  [{readOnly: 'timers'}, 'read-only'],
  [{missing: 'quick'}, 'not-found'],
  [{missing: 'timers'}, 'not-found'],
] as const)(
  'refuses unavailable or unwritable names: %j',
  (options, reason) => {
    expect(prepare(documentsOf(options))).toMatchObject({
      ok: false,
      error: {reason},
    });
  },
);

it('refuses a missing timer', () => {
  expect(prepare(documentsOf(), {...rename, timerId: id(99)})).toMatchObject({
    ok: false,
    error: {reason: 'not-found'},
  });
});
