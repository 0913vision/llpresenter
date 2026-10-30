import {expect, it} from 'vitest';
import {createTimerId} from '@core/schema/ids';
import {expectSuccess} from '@core/schema/testHelpers';
import {
  mergeSettingsDocument,
  parseSettingsDocument,
} from '@core/schema/settingsDocuments';
import {prepareTimerEdit} from './timerEditPlan';

const first = createTimerId('00000000-0000-4000-8000-000000000001');
const legacy = createTimerId('00000000-0000-4000-8000-000000000002');
const dated = createTimerId('00000000-0000-4000-8000-000000000003');
const missing = createTimerId('00000000-0000-4000-8000-000000000004');

function fixture(access: 'editable' | 'readOnly' = 'editable') {
  const document = expectSuccess(
    parseSettingsDocument({
      name: 'timers',
      revision: 7,
      access,
      value: {
        format: 'llsettings.timers',
        schemaVersion: 1,
        futureDocument: {keep: true},
        timers: [
          {
            id: first,
            name: 'First',
            kind: 'countdown',
            duration: 90,
            future: {keep: true},
          },
          {
            id: legacy,
            name: 'Legacy',
            kind: 'elapsedFrom',
            time: '09:15',
            future: 1,
          },
          {id: dated, name: 'Target', kind: 'countdownTo', time: '12:00'},
        ],
      },
    }),
  );
  if (document.name !== 'timers') throw Error('Invalid timer fixture');
  return document;
}

it('prepares a targeted edit that preserves identity and unknown fields through the real merge', () => {
  const document = fixture();
  const before = structuredClone(document);
  const draft = {
    kind: 'elapsed',
    start: 15,
    id: missing,
    name: 'Other',
    future: {keep: false},
  } as const;
  const plan = prepareTimerEdit(document, first, draft);
  expect(plan.kind).toBe('update');
  if (plan.kind !== 'update') throw Error('Expected an edit');
  expect(plan.edit.baseRevision).toBe(7);
  const merged = expectSuccess(mergeSettingsDocument(document, plan.edit));
  if (merged.name !== 'timers') throw Error('Expected timer settings');
  expect(merged.revision).toBe(8);
  expect(merged.value).toMatchObject({
    futureDocument: {keep: true},
    timers: [
      {
        id: first,
        name: 'First',
        kind: 'elapsed',
        start: 15,
        future: {keep: true},
      },
      {
        id: legacy,
        name: 'Legacy',
        kind: 'elapsedFrom',
        time: '09:15',
        future: 1,
      },
      {id: dated, name: 'Target', kind: 'countdownTo', time: '12:00'},
    ],
  });
  expect(merged.value.timers[0]).not.toHaveProperty('duration');
  expect(document).toEqual(before);
});

it('skips an unchanged countdown with implicit overrun and adds a date only when edited', () => {
  const document = fixture();
  expect(
    prepareTimerEdit(document, first, {
      kind: 'countdown',
      duration: 90,
      overrun: true,
    }),
  ).toEqual({kind: 'unchanged', revision: 7});
  const plan = prepareTimerEdit(document, dated, {
    kind: 'countdownTo',
    date: '2028-02-29',
    time: '12:00',
    overrun: true,
  });
  expect(plan.kind).toBe('update');
  if (plan.kind !== 'update') throw Error('Expected an edit');
  const merged = expectSuccess(mergeSettingsDocument(document, plan.edit));
  if (merged.name !== 'timers') throw Error('Expected timer settings');
  expect(merged.value.timers[2]).toMatchObject({
    date: '2028-02-29',
    overrun: true,
  });
});

it('allows editing legacy elapsed time without allowing that kind to be newly created', () => {
  const document = fixture();
  expect(
    prepareTimerEdit(document, legacy, {kind: 'elapsedFrom', time: '10:30'})
      .kind,
  ).toBe('update');
  expect(
    prepareTimerEdit(document, first, {kind: 'elapsedFrom', time: '10:30'}),
  ).toEqual({kind: 'refused', reason: 'invalid'});
  expect(
    prepareTimerEdit(document, legacy, {kind: 'elapsedFrom', time: '24:00'}),
  ).toEqual({kind: 'refused', reason: 'invalid'});
});

it('refuses read-only, missing and invalid edits without changing the document', () => {
  const document = fixture();
  const before = structuredClone(document);
  const draft = {kind: 'countdown', duration: 90, overrun: true} as const;
  expect(prepareTimerEdit(fixture('readOnly'), first, draft)).toEqual({
    kind: 'refused',
    reason: 'read-only',
  });
  expect(prepareTimerEdit(document, missing, draft)).toEqual({
    kind: 'refused',
    reason: 'not-found',
  });
  expect(prepareTimerEdit(document, first, {...draft, duration: 0})).toEqual({
    kind: 'refused',
    reason: 'invalid',
  });
  expect(document).toEqual(before);
});
