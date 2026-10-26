import {describe, expect, it} from 'vitest';
import type {Timer} from './schema/timers';
import {parseTimers} from './schema/timers';
import type {TimerRun} from './schema/timerState';
import {
  countedMs,
  isTimerTicking,
  localDay,
  timerText,
  type TimerNow,
} from './timerClock';

const WALL = new Date(2026, 9, 26, 10, 0, 0).getTime();
const TODAY = localDay(WALL);
const TIMER = 5_000_000;
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

/** Both clocks moved by the same amount from the fixture's start. */
const after = (ms: number): TimerNow => ({timer: TIMER + ms, wall: WALL + ms});

const running = (counted = 0, day = TODAY): TimerRun => ({
  state: 'running',
  since: TIMER,
  countedMs: counted,
  day,
});
const paused = (wallAt: number, counted: number, day = TODAY): TimerRun => ({
  state: 'paused',
  at: TIMER,
  countedMs: counted,
  day,
  wallAt,
});

describe('countedMs', () => {
  it('adds the running time to what was counted before', () => {
    expect(countedMs(undefined, TIMER)).toBe(0);
    expect(countedMs(running(2 * SECOND), TIMER + 5 * SECOND)).toBe(7 * SECOND);
    expect(countedMs(paused(WALL, 3 * SECOND), TIMER + HOUR)).toBe(3 * SECOND);
  });

  it('adds nothing for a reading before the start', () => {
    expect(countedMs(running(4 * SECOND), TIMER - MINUTE)).toBe(4 * SECOND);
  });
});

describe('timerText', () => {
  const thirtyFive = timer({kind: 'countdown', duration: 35 * 60});
  const minute = timer({kind: 'countdown', duration: 60});

  it('shows a countdown from its full duration and counts down while running', () => {
    expect(timerText(thirtyFive, undefined, after(0))).toBe('35:00');
    expect(timerText(thirtyFive, running(), after(90 * SECOND))).toBe('33:30');
    expect(timerText(thirtyFive, running(), after(90 * SECOND - 400))).toBe(
      '33:31',
    );
    expect(timerText(thirtyFive, paused(WALL, MINUTE), after(HOUR))).toBe(
      '34:00',
    );
  });

  it('never moves a running countdown back when the wall clock steps back', () => {
    const atThirty = timerText(minute, running(), after(30 * SECOND));
    const steppedBack = timerText(minute, running(), {
      timer: TIMER + 30 * SECOND,
      wall: WALL + 20 * SECOND,
    });
    expect([atThirty, steppedBack]).toEqual(['0:30', '0:30']);
  });

  it('keeps counting a countdown past 0 with a leading minus', () => {
    const counted = 35 * MINUTE;
    expect(timerText(thirtyFive, running(counted), after(500))).toBe('0:00');
    expect(timerText(thirtyFive, running(counted), after(61 * SECOND))).toBe(
      '-1:01',
    );
  });

  it('shows hours from an hour on', () => {
    const long = timer({kind: 'countdown', duration: 2 * 3600 + 5});
    expect(timerText(long, undefined, after(0))).toBe('2:00:05');
  });

  it('counts down to a time of day, and past it with a leading minus', () => {
    const service = timer({kind: 'countdownTo', time: '10:30'});
    expect(timerText(service, undefined, after(0))).toBe('30:00');
    expect(timerText(service, running(), after(31 * MINUTE))).toBe('-1:00');
    expect(timerText(service, paused(WALL + 10 * MINUTE, 0), after(HOUR))).toBe(
      '20:00',
    );
  });

  it('counts the time since a time of day', () => {
    const elapsed = timer({kind: 'elapsedFrom', time: '09:15'});
    expect(timerText(elapsed, running(), after(0))).toBe('45:00');
    expect(timerText(elapsed, undefined, after(HOUR))).toBe('1:45:00');
    const later = timer({kind: 'elapsedFrom', time: '10:01'});
    expect(timerText(later, undefined, after(0))).toBe('-1:00');
  });

  it('keeps the day a run started when it runs past midnight', () => {
    const lastMinute = timer({kind: 'countdownTo', time: '23:59'});
    const lateStart = timer({kind: 'elapsedFrom', time: '23:00'});
    const beforeMidnight = new Date(2026, 9, 26, 23, 59, 59).getTime();
    const afterMidnight = new Date(2026, 9, 27, 0, 0, 30).getTime();
    const read = (subject: Timer, wall: number) =>
      timerText(subject, running(), {timer: TIMER, wall});
    expect(read(lastMinute, beforeMidnight)).toBe('-0:59');
    expect(read(lastMinute, afterMidnight)).toBe('-1:30');
    expect(read(lateStart, beforeMidnight)).toBe('59:59');
    expect(read(lateStart, afterMidnight)).toBe('1:00:30');
    expect(
      timerText(lastMinute, paused(beforeMidnight, 0), {
        timer: TIMER,
        wall: afterMidnight,
      }),
    ).toBe('-0:59');
  });

  it('shows a clock as 24-hour HH:mm:ss', () => {
    const clock = timer({kind: 'clock'});
    expect(timerText(clock, undefined, after(13 * HOUR + 5 * SECOND))).toBe(
      '23:00:05',
    );
  });
});

describe('isTimerTicking', () => {
  it('ticks for a running 타이머 and a clock only', () => {
    const countdown = timer({kind: 'countdown', duration: 60});
    expect(isTimerTicking(countdown, undefined)).toBe(false);
    expect(isTimerTicking(countdown, running())).toBe(true);
    expect(isTimerTicking(countdown, paused(WALL, 0))).toBe(false);
    expect(isTimerTicking(timer({kind: 'clock'}), undefined)).toBe(true);
  });
});
