import * as v from 'valibot';

const LOCAL_DATE_TIME =
  /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d$/;
const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_LENGTH = 'YYYY-MM-DD'.length;

export const positiveInteger = v.pipe(v.number(), v.integer(), v.minValue(1));

export const nonNegativeNumber = v.pipe(v.number(), v.finite(), v.minValue(0));

export const nonBlankText = v.pipe(
  v.string(),
  v.check(text => text.trim().length > 0, 'Expected text that is not blank'),
);

/** A service date: local time without a time zone, `YYYY-MM-DDTHH:mm`. */
export const localDateTime = v.pipe(
  v.string(),
  v.regex(
    LOCAL_DATE_TIME,
    'Expected a local date and time as YYYY-MM-DDTHH:mm',
  ),
  v.check(isCalendarDate, 'Expected a date that exists in the calendar'),
);

export const timeOfDay = v.pipe(
  v.string(),
  v.regex(TIME_OF_DAY, 'Expected a time as HH:mm'),
);

/** A record timestamp: ISO 8601 with seconds and a time zone offset. */
export const timestamp = v.pipe(
  v.string(),
  v.isoTimestamp('Expected an ISO 8601 time with a time zone offset'),
);

/**
 * Whether no item before `index` has the same key. Use it in `v.checkItems` so
 * that the issue points at the repeated item.
 */
export function isFirstWithKey<TItem>(
  items: readonly TItem[],
  index: number,
  key: (item: TItem) => unknown,
): boolean {
  const item = items[index];
  return (
    item !== undefined &&
    items.findIndex(other => key(other) === key(item)) === index
  );
}

function isCalendarDate(dateTime: string): boolean {
  const date = dateTime.slice(0, DATE_LENGTH);
  const parsed = new Date(`${date}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(date)
  );
}
