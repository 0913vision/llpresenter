import {expect, it} from 'vitest';
import {MAX_TIMER_SECONDS} from '@core/schema/timers';
import {parseTimerDuration} from './TimerDurationFields';

it.each([
  ['0', '1', 1],
  ['1', '59', 119],
  ['60', '00', 3600],
  ['0002', '03', 123],
])('reads %s minutes and %s seconds', (minutes, seconds, duration) => {
  expect(parseTimerDuration(minutes, seconds)).toEqual({
    duration,
    minutesReason: undefined,
    secondsReason: undefined,
  });
});

it.each([
  ['', '1'],
  ['-1', '0'],
  ['1.5', '0'],
  ['1e2', '0'],
  [' 1', '0'],
  ['0', ''],
  ['0', '-1'],
  ['0', '60'],
  ['0', '1.5'],
  ['0', '1e1'],
  ['0', '0'],
  [String(MAX_TIMER_SECONDS), '0'],
  ['99999999999999999999999', '0'],
])(
  'rejects %s minutes and %s seconds with an inline reason',
  (minutes, seconds) => {
    const draft = parseTimerDuration(minutes, seconds);
    expect(draft.duration).toBeUndefined();
    expect(draft.minutesReason ?? draft.secondsReason).toBeTruthy();
  },
);

it('bounds the combined value even when both fields are individually valid', () => {
  const minutes = String(Math.floor(MAX_TIMER_SECONDS / 60));
  const seconds = String(MAX_TIMER_SECONDS % 60);
  expect(parseTimerDuration(minutes, seconds).duration).toBe(MAX_TIMER_SECONDS);
  const draft = parseTimerDuration(minutes, String(Number(seconds) + 1));
  expect(draft.duration).toBeUndefined();
  expect(draft.minutesReason).toBeTruthy();
});
