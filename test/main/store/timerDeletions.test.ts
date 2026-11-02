import {expect, it} from 'vitest';
import {
  parseSettingsDocument,
  parseSettingsEdit,
  type SettingsDocument,
  type SettingsName,
} from '@core/schema/settingsDocuments';
import {expectSuccess} from '@fixtures/core/schema/testHelpers';
import {createTimerId} from '@core/schema/ids';
import {prepareTimerDeletion} from '@main/store/timerDeletions';

const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const TARGET = createTimerId(id(1));
const KEEP = createTimerId(id(2));
const deletion = {type: 'timer.delete', name: 'timers', timerId: TARGET};
const linked = {
  id: id(11),
  kind: 'timer',
  ref: TARGET,
  name: 'Delete',
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
  return documents;
}

function prepare(
  documents: ReadonlyMap<SettingsName, SettingsDocument>,
  value: object = deletion,
) {
  const edit = expectSuccess(parseSettingsEdit(value));
  if (edit.type !== 'timer.delete') throw new Error('Not a timer deletion');
  return prepareTimerDeletion(documents, edit);
}

it.each([
  {kind: 'clock'},
  {kind: 'countdown', duration: 90, overrun: false},
  {kind: 'countdownTo', date: '2028-02-29', time: '12:00'},
  {kind: 'elapsed', start: 0},
])(
  'deletes $kind and every linked known row, keeping unrelated content',
  kind => {
    const other = {...linked, id: id(13), ref: KEEP, name: 'Keep row'};
    const future = {...linked, id: id(14), kind: 'future', name: 'Opaque row'};
    const documents = documentsOf({
      kind,
      rows: [linked, {...linked, id: id(12)}, other, future],
    });
    const before = documents.get('timers');

    const result = expectSuccess(prepare(documents));

    expect(result.applied).toEqual({id: TARGET, revision: 2});
    const [timers, quick] = result.documents;
    if (timers?.name !== 'timers' || before?.name !== 'timers') {
      throw Error('Missing timer documents');
    }
    expect(timers.value).toEqual({
      ...before.value,
      timers: before.value.timers.filter(timer => timer.id !== TARGET),
    });
    expect(quick).toMatchObject({
      name: 'quick',
      revision: 2,
      value: {future: {keep: true}, items: [other, future]},
    });
  },
);

it('deletes a timer alone when the read-only quick settings have no linked row', () => {
  const result = expectSuccess(
    prepare(documentsOf({readOnly: 'quick', rows: []})),
  );

  expect(result.documents.map(document => document.name)).toEqual(['timers']);
});

it.each([
  [{readOnly: 'timers'}, 'read-only'],
  [{readOnly: 'quick'}, 'read-only'],
  [{missing: 'timers'}, 'not-found'],
  [{missing: 'quick'}, 'not-found'],
] as const)(
  'refuses unavailable or unwritable documents: %j',
  (options, reason) => {
    expect(prepare(documentsOf(options))).toMatchObject({
      ok: false,
      error: {reason},
    });
  },
);

it('refuses a missing timer', () => {
  expect(prepare(documentsOf(), {...deletion, timerId: id(100)})).toMatchObject(
    {ok: false, error: {reason: 'not-found'}},
  );
});
