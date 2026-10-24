/** A decoded JSON object whose fields are not checked yet. */
export type JsonObject = Readonly<Record<string, unknown>>;

/** Tells a JSON object apart from arrays, `null`, and other values. */
export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
