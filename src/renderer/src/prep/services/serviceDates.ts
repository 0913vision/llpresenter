const WEEKDAYS = [
  '일요일',
  '월요일',
  '화요일',
  '수요일',
  '목요일',
  '금요일',
  '토요일',
];
const DAYS_AHEAD = 13;
const STEP_MINUTES = 30;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;
const HALF_DAY_HOURS = 12;
const PAD = 2;

/** A date choice, such as 2026-11-01 shown as 11월 1일 일요일. */
export interface DateChoice {
  readonly value: string;
  readonly label: string;
}

function padded(value: number): string {
  return String(value).padStart(PAD, '0');
}

/** A local date as YYYY-MM-DD. */
export function localDate(date: Date): string {
  return `${date.getFullYear()}-${padded(date.getMonth() + 1)}-${padded(date.getDate())}`;
}

function dateOf(value: string): Date {
  const [year = 0, month = 1, day = 1] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** A local date as the dialogs show it, such as 10월 25일 일요일. */
export function dateLabel(value: string): string {
  const date = dateOf(value);
  return `${date.getMonth() + 1}월 ${date.getDate()}일 ${WEEKDAYS[date.getDay()] ?? ''}`;
}

/** A time HH:mm as the dialogs show it, such as 오전 11:00. */
export function timeLabel(value: string): string {
  const [hours = 0, minutes = 0] = value.split(':').map(Number);
  const period = hours < HALF_DAY_HOURS ? '오전' : '오후';
  const hour =
    hours % HALF_DAY_HOURS === 0 ? HALF_DAY_HOURS : hours % HALF_DAY_HOURS;
  return `${period} ${hour}:${padded(minutes)}`;
}

// TODO(0913vision): Replace the date list with the calendar popover once the
// design system has one (spec 05, "New service").
/** Today and the next 13 days, plus the chosen date if it isn't among them. */
export function dateChoices(
  today: Date,
  chosen: string,
): readonly DateChoice[] {
  const days = Array.from({length: DAYS_AHEAD + 1}, (_, offset) =>
    localDate(
      new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset),
    ),
  );
  const values = days.includes(chosen) ? days : [chosen, ...days].sort();
  return values.map(value => ({value, label: dateLabel(value)}));
}

/** The times of a day in 30-minute steps, plus the chosen time if off a step. */
export function timeChoices(chosen: string): readonly DateChoice[] {
  const steps = Array.from(
    {length: MINUTES_PER_DAY / STEP_MINUTES},
    (_, step) => {
      const minutes = step * STEP_MINUTES;
      return `${padded(Math.floor(minutes / MINUTES_PER_HOUR))}:${padded(minutes % MINUTES_PER_HOUR)}`;
    },
  );
  const values = steps.includes(chosen) ? steps : [...steps, chosen].sort();
  return values.map(value => ({value, label: timeLabel(value)}));
}
