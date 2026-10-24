import * as v from 'valibot';
import type {Result} from '../result';

/** Why a value from another process was rejected. */
export interface PayloadError {
  /** Dot path of the failing field, such as `sizeClass`, or `''`. */
  readonly field: string;
  readonly message: string;
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
