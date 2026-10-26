export interface CalendarDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

export type CalendarMonth = Pick<CalendarDate, 'year' | 'month'>;

export interface CalendarDay {
  readonly date: CalendarDate;
  /** Null for cells beyond the supported years. */
  readonly value: string | null;
  readonly currentMonth: boolean;
}

const MIN_YEAR = 0;
const MAX_YEAR = 9999;
const MONTHS_PER_YEAR = 12;
const WEEK_DAYS = 7;
const GRID_DAYS = 6 * WEEK_DAYS;
const WEEKDAY_NAMES = [
  '일요일',
  '월요일',
  '화요일',
  '수요일',
  '목요일',
  '금요일',
  '토요일',
];
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function utc({year, month, day}: CalendarDate): Date {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(12, 0, 0, 0);
  return date;
}

function fromUtc(date: Date): CalendarDate {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function supported(date: CalendarDate): boolean {
  return date.year >= MIN_YEAR && date.year <= MAX_YEAR;
}

/** Validates a civil YYYY-MM-DD date without local-time or year-1900 coercion. */
export function parseCalendarDate(value: string): CalendarDate | null {
  const match = ISO_DATE.exec(value);
  if (match === null) return null;
  const date = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
  const normalized = fromUtc(utc(date));
  return normalized.year === date.year &&
    normalized.month === date.month &&
    normalized.day === date.day
    ? date
    : null;
}

export function calendarDateValue({year, month, day}: CalendarDate): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function localCalendarDate(date: Date): CalendarDate {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  };
}

export function calendarWeekday(date: CalendarDate): number {
  return utc(date).getUTCDay();
}

export function calendarDateLabel(date: CalendarDate): string {
  return `${date.year}년 ${calendarFieldLabel(date)}`;
}

export function calendarFieldLabel(date: CalendarDate): string {
  return `${date.month}월 ${date.day}일 ${WEEKDAY_NAMES[calendarWeekday(date)] ?? ''}`;
}

export function calendarMonthLabel({year, month}: CalendarMonth): string {
  return `${year}년 ${month}월`;
}

/** Six Sunday-first weeks, with disabled cells outside years 0000 through 9999. */
export function calendarDays(month: CalendarMonth): readonly CalendarDay[] {
  const first = {...month, day: 1};
  const offset = calendarWeekday(first);
  return Array.from({length: GRID_DAYS}, (_, index) => {
    const date = fromUtc(utc({...month, day: 1 - offset + index}));
    return {
      date,
      value: supported(date) ? calendarDateValue(date) : null,
      currentMonth: date.year === month.year && date.month === month.month,
    };
  });
}

/** Moves across civil days, clamping at the supported year bounds. */
export function shiftCalendarDays(
  date: CalendarDate,
  days: number,
): CalendarDate {
  const shifted = fromUtc(utc({...date, day: date.day + days}));
  if (shifted.year < MIN_YEAR) return {year: MIN_YEAR, month: 1, day: 1};
  if (shifted.year > MAX_YEAR) return {year: MAX_YEAR, month: 12, day: 31};
  return shifted;
}

/** Keeps the day when possible; month/year moves clamp to the month's last day. */
export function shiftCalendarMonths(
  date: CalendarDate,
  months: number,
): CalendarDate {
  const index = Math.max(
    0,
    Math.min(
      (MAX_YEAR + 1) * MONTHS_PER_YEAR - 1,
      date.year * MONTHS_PER_YEAR + date.month - 1 + months,
    ),
  );
  const year = Math.floor(index / MONTHS_PER_YEAR);
  const month = (index % MONTHS_PER_YEAR) + 1;
  const lastDay = utc({year, month: month + 1, day: 0}).getUTCDate();
  return {year, month, day: Math.min(date.day, lastDay)};
}
