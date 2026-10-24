import {describe, expectTypeOf, it} from 'vitest';
import {expectInvalidField, expectRoundTrip} from './testHelpers';
import {parseTimers, serializeTimers, type Timer} from './timers';

const codec = {parse: parseTimers, serialize: serializeTimers};

function timerId(number: number): string {
  return `b9b8b7b6-0000-4222-8333-${String(number).padStart(12, '0')}`;
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

describe('timer types', () => {
  it('ties the time and duration fields to the kind', () => {
    expectTypeOf<
      Extract<Timer, {kind: 'countdown'}>['duration']
    >().toEqualTypeOf<number>();
    expectTypeOf<
      Extract<Timer, {kind: 'countdownTo'}>['time']
    >().toEqualTypeOf<string>();
  });
});
