import * as v from 'valibot';

const LOCAL_DATE_TIME =
  /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d$/;
const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_LENGTH = 'YYYY-MM-DD'.length;
const NOT_AN_OBJECT = 'Invalid type: Expected Object';
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const PERCENT_MAX = 100;
const DUPLICATE_ID_MESSAGE = 'Another item already has this id';

export const positiveInteger = v.pipe(v.number(), v.integer(), v.minValue(1));

export const nonNegativeNumber = v.pipe(v.number(), v.finite(), v.minValue(0));

export const positiveNumber = v.pipe(v.number(), v.finite(), v.gtValue(0));

export const finiteNumber = v.pipe(v.number(), v.finite());

export const nonNegativeInteger = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(0),
);

/** A percentage from 0 to 100. */
export const percent = v.pipe(nonNegativeNumber, v.maxValue(PERCENT_MAX));

/** A time span in seconds. */
export const seconds = nonNegativeNumber;

export const hexColor = v.pipe(
  v.string(),
  v.regex(HEX_COLOR, 'Expected a color as #RRGGBB'),
);

export const pixelSize = v.looseObject({
  width: positiveInteger,
  height: positiveInteger,
});

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

/** An array whose items each have an `id`, with no id used twice. */
export function listWithUniqueIds<
  TItem extends v.GenericSchema<unknown, {readonly id: unknown}>,
>(item: TItem) {
  return v.pipe(
    v.array(item),
    v.checkItems(
      (_item, index, items) => isFirstWithKey(items, index, ({id}) => id),
      DUPLICATE_ID_MESSAGE,
    ),
  );
}

function isCalendarDate(dateTime: string): boolean {
  const date = dateTime.slice(0, DATE_LENGTH);
  const parsed = new Date(`${date}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(date)
  );
}

/**
 * A JSON object with these fields that keeps unknown fields. Unlike
 * `v.looseObject` alone, it rejects an array, which would otherwise pass and
 * turn into an object.
 */
export function jsonObject<TEntries extends v.ObjectEntries>(
  entries: TEntries,
) {
  return v.pipe(
    v.custom<Readonly<Record<string, unknown>>>(isJsonObject, NOT_AN_OBJECT),
    v.looseObject(entries),
  );
}

function isJsonObject(input: unknown): boolean {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}
