import {describe, expect, expectTypeOf, it} from 'vitest';
import {parseSettingsDocument, parseSettingsEdit} from './settingsDocuments';
import type {Seconds} from './primitives';
import {expectInvalidField, expectRoundTrip} from './testHelpers';
import {
  MAX_TIMER_SECONDS,
  parseTimers,
  serializeTimers,
  type Timer,
} from './timers';

const codec = {parse: parseTimers, serialize: serializeTimers};

function timerId(number: number): string {
  return `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
}

function timersFile(timers: readonly object[]) {
  return {format: 'llsettings.timers', schemaVersion: 1, timers};
}

function sampleTimers() {
  return [
    {id: timerId(1), name: '예배 시작', kind: 'countdownTo', time: '10:30'},
    {id: timerId(2), name: '설교', kind: 'countdown', duration: 2100},
    {id: timerId(3), name: '예배 경과', kind: 'elapsedFrom', time: '10:30'},
    {id: timerId(4), name: '현재 시각', kind: 'clock'},
    {
      id: timerId(5),
      name: 'Tomorrow',
      kind: 'countdownTo',
      date: '2024-02-29',
      time: '12:00',
    },
    {id: timerId(6), name: 'Stopwatch', kind: 'elapsed', start: 0},
  ];
}

describe('parseTimers', () => {
  it('reads a 타이머 of every kind', () => {
    expectRoundTrip(codec, timersFile(sampleTimers()));
  });

  it.each([
    [
      'an unknown kind',
      {id: timerId(1), name: 't', kind: 'stopwatch'},
      'timers.0.kind',
    ],
    [
      'a countdown without a duration',
      {id: timerId(1), name: 't', kind: 'countdown'},
      'timers.0.duration',
    ],
    [
      'a zero duration',
      {id: timerId(1), name: 't', kind: 'countdown', duration: 0},
      'timers.0.duration',
    ],
    [
      'a time with seconds',
      {id: timerId(1), name: 't', kind: 'countdownTo', time: '10:30:00'},
      'timers.0.time',
    ],
    [
      'an elapsed timer without a time',
      {id: timerId(1), name: 't', kind: 'elapsedFrom'},
      'timers.0.time',
    ],
  ])('rejects %s', (_name, timer, field) => {
    expectInvalidField(codec, timersFile([timer]), field);
  });
});

describe('timer date and elapsed settings boundaries', () => {
  const settings = (fields: object) =>
    timersFile([{id: timerId(1), name: 'Fixture', ...fields}]);

  function accepted(fields: object): boolean[] {
    const value = settings(fields);
    return [
      parseSettingsDocument({
        name: 'timers',
        value,
        revision: 1,
        access: 'editable',
      }).ok,
      parseSettingsEdit({
        type: 'settings.update',
        name: 'timers',
        value,
        baseRevision: 1,
      }).ok,
    ];
  }

  it.each(['countdown', 'countdownTo'])(
    'accepts optional overrun only as a Boolean for %s',
    kind => {
      const fields = {kind, duration: 30, time: '12:00'};
      for (const overrun of [true, false]) {
        expect(accepted({...fields, overrun})).toEqual([true, true]);
        expectRoundTrip(codec, settings({...fields, overrun}));
      }
      for (const overrun of [null, 'false', 0]) {
        expect(accepted({...fields, overrun})).toEqual([false, false]);
      }
      expect(accepted(fields)).toEqual([true, true]);
    },
  );

  it.each(['2024-02-29', '2026-10-27', undefined])(
    'accepts a real date or a legacy undated target: %s',
    date => {
      const fields = {
        kind: 'countdownTo',
        time: '12:00',
        ...(date === undefined ? {} : {date}),
      };
      expect(accepted(fields)).toEqual([true, true]);
      expectRoundTrip(codec, settings({...fields, futureField: {keep: true}}));
    },
  );

  it.each([
    '2026-02-29',
    '2026-11-31',
    '2026-1-01',
    '2026-10-27T12:00',
    '',
    null,
  ])('rejects an invalid calendar date: %s', date => {
    expect(accepted({kind: 'countdownTo', time: '12:00', date})).toEqual([
      false,
      false,
    ]);
  });

  it.each([0, 0.25, 3600, MAX_TIMER_SECONDS])(
    'accepts a bounded elapsed start: %s',
    start => {
      expect(accepted({kind: 'elapsed', start})).toEqual([true, true]);
      expectRoundTrip(
        codec,
        settings({kind: 'elapsed', start, futureField: 'kept'}),
      );
    },
  );

  it.each([-1, NaN, Infinity, MAX_TIMER_SECONDS + 1, '30', null, undefined])(
    'rejects an invalid elapsed start: %s',
    start => {
      expect(accepted({kind: 'elapsed', start})).toEqual([false, false]);
    },
  );
});

describe('timer types', () => {
  it('ties the time and duration fields to the kind', () => {
    expectTypeOf<
      Extract<Timer, {kind: 'countdown'}>['duration']
    >().toEqualTypeOf<Seconds>();
    expectTypeOf<
      Extract<Timer, {kind: 'countdownTo'}>['time']
    >().toEqualTypeOf<string>();
  });
});
