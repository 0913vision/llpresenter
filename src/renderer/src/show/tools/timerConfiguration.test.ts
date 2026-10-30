import {expect, it} from 'vitest';
import {MAX_TIMER_SECONDS} from '@core/schema/timers';
import {
  localDateText,
  timerDateReason,
  timerTimeReason,
  validTimerConfiguration,
} from '@core/timers/timerConfiguration';
import {parseTimerDuration} from './TimerDurationFields';

it('checks real calendar dates and strict 24-hour times with the persisted schemas', () => {
  for (const date of ['2028-02-29', '2026-10-28']) {
    expect(timerDateReason(date)).toBeUndefined();
  }
  for (const date of ['', '2027-02-29', '2026-04-31', '2026-1-01']) {
    expect(timerDateReason(date)).toBeDefined();
  }
  for (const time of ['00:00', '23:59']) {
    expect(timerTimeReason(time)).toBeUndefined();
  }
  for (const time of ['', '24:00', '12:60', '1:00']) {
    expect(timerTimeReason(time)).toBeDefined();
  }
  expect(localDateText(new Date(2026, 9, 28, 0, 1))).toBe('2026-10-28');
});

it('bounds elapsed starts and keeps the countdown minimum independent', () => {
  expect(parseTimerDuration('0', '0').duration).toBeUndefined();
  expect(parseTimerDuration('0', '0', 0).duration).toBe(0);
  expect(parseTimerDuration('1', '59', 0).duration).toBe(119);
  for (const start of [-1, 0.5, NaN, Infinity, MAX_TIMER_SECONDS + 1]) {
    expect(validTimerConfiguration({kind: 'elapsed', start})).toBe(false);
  }
  expect(
    validTimerConfiguration({kind: 'elapsed', start: MAX_TIMER_SECONDS}),
  ).toBe(true);
  expect(
    validTimerConfiguration({
      kind: 'countdownTo',
      date: '2027-02-29',
      time: '12:00',
      overrun: true,
    }),
  ).toBe(false);
});
