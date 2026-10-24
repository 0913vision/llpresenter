import * as v from 'valibot';
import type {Result} from '../result';
import {isJsonObject} from './primitives';

const NOT_AN_OBJECT = 'Invalid type: Expected Object';

/** Why a value from another process was rejected. */
export interface PayloadError {
  /** Dot path of the failing field, such as `sizeClass`, or `''`. */
  readonly field: string;
  readonly message: string;
}

/**
 * An IPC object with these fields. Unknown fields are dropped, and an array is
 * rejected instead of turning into an object.
 */
export function payloadObject<TEntries extends v.ObjectEntries>(
  entries: TEntries,
) {
  return v.pipe(
    v.custom<Readonly<Record<string, unknown>>>(isJsonObject, NOT_AN_OBJECT),
    v.object(entries),
  );
}

/**
 * Checks a value that arrived over IPC. The result holds only the known
 * fields; unknown ones are dropped. Never throws.
 */
export function parsePayload<TSchema extends v.GenericSchema>(
  schema: TSchema,
  value: unknown,
): Result<v.InferOutput<TSchema>, PayloadError> {
  const result = v.safeParse(schema, value, {abortEarly: true});
  if (result.success) {
    return {ok: true, value: result.output};
  }
  const [issue] = result.issues;
  return {
    ok: false,
    error: {field: v.getDotPath(issue) ?? '', message: issue.message},
  };
}
