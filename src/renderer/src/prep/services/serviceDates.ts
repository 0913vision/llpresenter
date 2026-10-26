import {
  calendarDateValue,
  calendarFieldLabel,
  localCalendarDate,
  parseCalendarDate,
} from '@renderer/ui/calendarDates';
const STEP_MINUTES = 30;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;
const HALF_DAY_HOURS = 12;
const PAD = 2;

/** A time choice, such as 11:00 shown as 오전 11:00. */
export interface TimeChoice {
  readonly value: string;
  readonly label: string;
}

function padded(value: number): string {
  return String(value).padStart(PAD, '0');
}

/** A local date as YYYY-MM-DD. */
export function localDate(date: Date): string {
  return calendarDateValue(localCalendarDate(date));
}

/** A local date as the dialogs show it, such as 10월 25일 일요일. */
export function dateLabel(value: string): string {
  const date = parseCalendarDate(value);
  return date === null ? value : calendarFieldLabel(date);
}

/** A time HH:mm as the dialogs show it, such as 오전 11:00. */
export function timeLabel(value: string): string {
  const [hours = 0, minutes = 0] = value.split(':').map(Number);
  const period = hours < HALF_DAY_HOURS ? '오전' : '오후';
  const hour =
    hours % HALF_DAY_HOURS === 0 ? HALF_DAY_HOURS : hours % HALF_DAY_HOURS;
  return `${period} ${hour}:${padded(minutes)}`;
}

/** The times of a day in 30-minute steps, plus the chosen time if off a step. */
export function timeChoices(chosen: string): readonly TimeChoice[] {
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
