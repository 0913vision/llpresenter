import {expect, it} from 'vitest';
import {parseTimers} from '@shared/schema/timers';
import {expectSuccess} from '@shared/schema/testHelpers';
import {timerEditDraft} from './timerEditDraft';

it('preserves each saved timer kind and its settings in an edit draft', () => {
  const items = [
    {kind: 'countdown', duration: 90},
    {kind: 'countdown', duration: 1.5, overrun: false},
    {kind: 'countdownTo', time: '23:59'},
    {kind: 'countdownTo', time: '08:30', date: '2028-02-29', overrun: false},
    {kind: 'elapsed', start: 0},
    {kind: 'elapsedFrom', time: '09:15'},
    {kind: 'clock'},
  ].map((item, n) => ({
    ...item,
    id: `00000000-0000-4000-8000-${String(n + 1).padStart(12, '0')}`,
    name: `Timer ${n + 1}`,
    future: {keep: true},
  }));
  const file = expectSuccess(
    parseTimers(
      JSON.stringify({
        format: 'llsettings.timers',
        schemaVersion: 1,
        timers: items,
      }),
      'timers.json',
    ),
  );
  const before = structuredClone(file.data);
  expect(
    file.data.timers.map(timer => timerEditDraft(timer, '2026-10-28')),
  ).toEqual([
    {kind: 'countdown', duration: 90, overrun: true},
    {kind: 'countdown', duration: 1.5, overrun: false},
    {kind: 'countdownTo', time: '23:59', date: '2026-10-28', overrun: true},
    {kind: 'countdownTo', time: '08:30', date: '2028-02-29', overrun: false},
    {kind: 'elapsed', start: 0},
    {kind: 'elapsedFrom', time: '09:15'},
    {kind: 'clock'},
  ]);
  expect(file.data).toEqual(before);
});
