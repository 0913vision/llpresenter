import {describe, expect, it} from 'vitest';
import {
  calendarDateLabel,
  calendarDateValue,
  calendarDays,
  calendarFieldLabel,
  calendarMonthLabel,
  calendarWeekday,
  localCalendarDate,
  parseCalendarDate,
  shiftCalendarDays,
  shiftCalendarMonths,
} from './calendarDates';

describe('calendar civil dates', () => {
  it.each([
    '0000-02-29',
    '0001-01-01',
    '0099-12-31',
    '2024-02-29',
    '9999-12-31',
  ])('round trips %s without changing its year', value => {
    const date = parseCalendarDate(value);
    if (date === null) throw new Error('Missing valid date');
    expect(calendarDateValue(date)).toBe(value);
  });

  it.each([
    '2026-02-29',
    '1900-02-29',
    '2026-04-31',
    '2026-00-10',
    '2026-13-01',
    '2026-01-00',
    '2026-1-01',
    '10000-01-01',
    'not a date',
  ])('refuses the invalid date %s', value =>
    expect(parseCalendarDate(value)).toBeNull(),
  );

  it.each(Array.from({length: 12}, (_, month) => month + 1))(
    'builds six Sunday-first weeks for month %i',
    month => {
      const days = calendarDays({year: 2026, month});
      expect(days).toHaveLength(42);
      const first = days[0];
      if (first === undefined) throw new Error('No first day');
      expect(calendarWeekday(first.date)).toBe(0);
      expect(new Set(days.map(day => day.value)).size).toBe(42);
      expect(
        days.filter(day => day.currentMonth).map(day => day.date.day),
      ).toEqual(
        Array.from(
          {length: new Date(Date.UTC(2026, month, 0)).getUTCDate()},
          (_, day) => day + 1,
        ),
      );
    },
  );

  it('disables adjacent cells beyond the supported years', () => {
    const lower = calendarDays({year: 0, month: 1});
    const upper = calendarDays({year: 9999, month: 12});
    expect(lower.filter(day => day.value === null).length).toBeGreaterThan(0);
    expect(upper.filter(day => day.value === null).length).toBeGreaterThan(0);
    expect(lower.find(day => day.currentMonth)?.value).toBe('0000-01-01');
    expect(upper.filter(day => day.currentMonth).at(-1)?.value).toBe(
      '9999-12-31',
    );
  });

  it('moves by civil days across daylight-saving and year boundaries', () => {
    expect(shiftCalendarDays({year: 2026, month: 3, day: 8}, 1)).toEqual({
      year: 2026,
      month: 3,
      day: 9,
    });
    expect(shiftCalendarDays({year: 2026, month: 12, day: 31}, 1)).toEqual({
      year: 2027,
      month: 1,
      day: 1,
    });
    expect(shiftCalendarDays({year: 0, month: 1, day: 1}, -7)).toEqual({
      year: 0,
      month: 1,
      day: 1,
    });
    expect(shiftCalendarDays({year: 9999, month: 12, day: 31}, 7)).toEqual({
      year: 9999,
      month: 12,
      day: 31,
    });
  });

  it('clamps month and year moves without spilling into another month', () => {
    expect(shiftCalendarMonths({year: 2026, month: 1, day: 31}, 1)).toEqual({
      year: 2026,
      month: 2,
      day: 28,
    });
    expect(shiftCalendarMonths({year: 2024, month: 1, day: 31}, 1)).toEqual({
      year: 2024,
      month: 2,
      day: 29,
    });
    expect(shiftCalendarMonths({year: 2024, month: 2, day: 29}, 12)).toEqual({
      year: 2025,
      month: 2,
      day: 28,
    });
    expect(shiftCalendarMonths({year: 0, month: 1, day: 1}, -1)).toEqual({
      year: 0,
      month: 1,
      day: 1,
    });
    expect(shiftCalendarMonths({year: 9999, month: 12, day: 31}, 1)).toEqual({
      year: 9999,
      month: 12,
      day: 31,
    });
  });

  it('keeps local date parts and names the full date for assistive technology', () => {
    const date = localCalendarDate(new Date(2026, 10, 1, 23, 59));
    expect(calendarDateValue(date)).toBe('2026-11-01');
    expect(calendarDateLabel(date)).toBe('2026년 11월 1일 일요일');
    expect(calendarFieldLabel(date)).toBe('11월 1일 일요일');
    expect(calendarMonthLabel(date)).toBe('2026년 11월');
  });
});
