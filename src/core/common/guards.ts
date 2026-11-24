/** A plain object with unknown values. */
export type UnknownRecord = Readonly<Record<string, unknown>>;

/** Whether the value is a plain object, not null and not an array. */
export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
