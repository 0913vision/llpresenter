import {
  calendarDateValue,
  calendarFieldLabel,
  localCalendarDate,
  parseCalendarDate,
} from '@renderer/ui/fields/calendarDates';

/** A local date as YYYY-MM-DD. */
export function localDate(date: Date): string {
  return calendarDateValue(localCalendarDate(date));
}

/** A local date as the dialogs show it, such as 10월 25일 일요일. */
export function dateLabel(value: string): string {
  const date = parseCalendarDate(value);
  return date === null ? value : calendarFieldLabel(date);
}
