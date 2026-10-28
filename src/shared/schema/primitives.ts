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
export const percent = v.pipe(
  nonNegativeNumber,
  v.maxValue(PERCENT_MAX),
  v.flavor('Percent'),
);

/** A time span in seconds. */
export const seconds = v.pipe(nonNegativeNumber, v.flavor('Seconds'));

/** A time span in seconds that is more than 0. */
export const positiveSeconds = v.pipe(positiveNumber, v.flavor('Seconds'));

/** A position in px, which can be negative. */
export const pixelPosition = v.pipe(finiteNumber, v.flavor('Pixels'));

/** A length in px. */
export const pixelLength = v.pipe(nonNegativeNumber, v.flavor('Pixels'));

/** A whole number of px that is more than 0, such as a resolution. */
export const pixelCount = v.pipe(positiveInteger, v.flavor('Pixels'));

/** A position in whole px, such as a monitor's place on the desktop. */
export const wholePixelPosition = v.pipe(
  v.number(),
  v.integer(),
  v.flavor('Pixels'),
);

/**
 * Seconds. A plain number can become one, but a value of another unit can't, so
 * the type checker keeps units apart.
 */
export type Seconds = v.InferOutput<typeof seconds>;

/** A percentage from 0 to 100, kept apart from other units like {@link Seconds}. */
export type Percent = v.InferOutput<typeof percent>;

/** Pixels, kept apart from other units like {@link Seconds}. */
export type Pixels = v.InferOutput<typeof pixelLength>;

export const hexColor = v.pipe(
  v.string(),
  v.regex(HEX_COLOR, 'Expected a color as #RRGGBB'),
);

export const pixelSize = jsonObject({
  width: pixelCount,
  height: pixelCount,
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

export const calendarDate = v.pipe(
  v.string(),
  v.isoDate('Expected a date as YYYY-MM-DD'),
  v.check(isCalendarDate, 'Expected a date that exists in the calendar'),
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
    v.rawCheck<Array<v.InferOutput<TItem>>>(({dataset, addIssue}) => {
      if (!dataset.typed) return;
      const seen = new Set<unknown>();
      for (const [index, entry] of dataset.value.entries()) {
        const {id} = entry;
        if (typeof id === 'number' && Number.isNaN(id)) continue;
        if (seen.has(id)) {
          addIssue({
            input: entry,
            message: DUPLICATE_ID_MESSAGE,
            path: [
              {
                type: 'array',
                origin: 'value',
                input: dataset.value,
                key: index,
                value: entry,
              },
            ],
          });
        } else {
          seen.add(id);
        }
      }
    }),
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

/** A JSON object used as a record. Like {@link jsonObject}, it rejects arrays. */
export function jsonRecord<
  TKey extends v.BaseSchema<string, string, v.BaseIssue<unknown>>,
  TValue extends v.GenericSchema,
>(key: TKey, value: TValue) {
  return v.pipe(
    v.custom<Readonly<Record<string, unknown>>>(isJsonObject, NOT_AN_OBJECT),
    v.record(key, value),
  );
}

/**
 * Whether a value is a plain JSON object: not `null`, not an array, and not an
 * object with a prototype of its own, whose inherited fields would pass for its
 * own.
 */
export function isJsonObject(input: unknown): boolean {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return false;
  }
  const prototype: unknown = Object.getPrototypeOf(input);
  return prototype === Object.prototype || prototype === null;
}
