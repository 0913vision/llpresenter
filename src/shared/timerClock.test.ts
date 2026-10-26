import {describe, expect, it} from 'vitest';
import type {Timer} from './schema/timers';
import {parseTimers} from './schema/timers';
import type {TimerRun} from './schema/timerState';
import {countedMs, isTimerTicking, timerText} from './timerClock';

const NOW = new Date(2026, 9, 26, 10, 0, 0).getTime();
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

function timer(fields: object): Timer {
  const parsed = parseTimers(
    JSON.stringify({
      format: 'llsettings.timers',
      schemaVersion: 1,
      timers: [
        {
          id: '00000000-0000-4000-8000-000000000090',
          name: 'Fixture',
          ...fields,
        },
      ],
    }),
    'timers.json',
  );
  const first = parsed.ok ? parsed.value.data.timers[0] : undefined;
  if (first === undefined) throw new Error('Invalid timer fixture');
  return first;
}

const running = (since: number, counted = 0): TimerRun => ({
  state: 'running',
  since,
  countedMs: counted,
});
const paused = (at: number, counted: number): TimerRun => ({
  state: 'paused',
  at,
  countedMs: counted,
});

describe('countedMs', () => {
  it('adds the running time to what was counted before', () => {
    expect(countedMs(undefined, NOW)).toBe(0);
    expect(countedMs(running(NOW - 5 * SECOND, 2 * SECOND), NOW)).toBe(
      7 * SECOND,
    );
    expect(countedMs(paused(NOW - HOUR, 3 * SECOND), NOW)).toBe(3 * SECOND);
  });

  it('never counts backwards when the clock steps back', () => {
    expect(countedMs(running(NOW + MINUTE, 4 * SECOND), NOW)).toBe(4 * SECOND);
  });
});

describe('timerText', () => {
  const thirtyFive = timer({kind: 'countdown', duration: 35 * 60});

  it('shows a countdown from its full duration and counts down while running', () => {
    expect(timerText(thirtyFive, undefined, NOW)).toBe('35:00');
    expect(timerText(thirtyFive, running(NOW - 90 * SECOND), NOW)).toBe(
      '33:30',
    );
    expect(timerText(thirtyFive, running(NOW - 90 * SECOND + 400), NOW)).toBe(
      '33:31',
    );
    expect(timerText(thirtyFive, paused(NOW, MINUTE), NOW + HOUR)).toBe(
      '34:00',
    );
  });

  it('keeps counting a countdown past 0 with a leading minus', () => {
    const counted = 35 * MINUTE;
    expect(timerText(thirtyFive, running(NOW, counted), NOW + 500)).toBe(
      '0:00',
    );
    expect(
      timerText(thirtyFive, running(NOW, counted), NOW + 61 * SECOND),
    ).toBe('-1:01');
  });

  it('shows hours from an hour on', () => {
    const long = timer({kind: 'countdown', duration: 2 * 3600 + 5});
    expect(timerText(long, undefined, NOW)).toBe('2:00:05');
  });

  it('counts down to a time of day, and past it with a leading minus', () => {
    const service = timer({kind: 'countdownTo', time: '10:30'});
    expect(timerText(service, undefined, NOW)).toBe('30:00');
    expect(timerText(service, running(NOW), NOW + 31 * MINUTE)).toBe('-1:00');
    expect(timerText(service, paused(NOW + 10 * MINUTE, 0), NOW + HOUR)).toBe(
      '20:00',
    );
  });

  it('counts the time since a time of day', () => {
    const elapsed = timer({kind: 'elapsedFrom', time: '09:15'});
    expect(timerText(elapsed, running(NOW), NOW)).toBe('45:00');
    expect(timerText(elapsed, undefined, NOW + HOUR)).toBe('1:45:00');
    const later = timer({kind: 'elapsedFrom', time: '10:01'});
    expect(timerText(later, undefined, NOW)).toBe('-1:00');
  });

  it('shows a clock as 24-hour HH:mm:ss', () => {
    const clock = timer({kind: 'clock'});
    expect(timerText(clock, undefined, NOW + 13 * HOUR + 5 * SECOND)).toBe(
      '23:00:05',
    );
  });
});

describe('isTimerTicking', () => {
  it('ticks for a running 타이머 and a clock only', () => {
    const countdown = timer({kind: 'countdown', duration: 60});
    expect(isTimerTicking(countdown, undefined)).toBe(false);
    expect(isTimerTicking(countdown, running(NOW))).toBe(true);
    expect(isTimerTicking(countdown, paused(NOW, 0))).toBe(false);
    expect(isTimerTicking(timer({kind: 'clock'}), undefined)).toBe(true);
  });
});
