import * as v from 'valibot';
import {
  parsePayload,
  payloadObject,
  type PayloadError,
} from '../common/payload';
import type {Result} from '@core/common/result';

const schema = payloadObject({
  wall: v.pipe(v.number(), v.finite()),
  monotonic: v.pipe(v.number(), v.finite()),
  timeZone: v.pipe(v.string(), v.nonEmpty(), v.maxLength(128)),
});
/**
 * A reading of the wall clock and the monotonic clock in ms, taken together,
 * with the time zone name.
 */
export type WallClockSample = v.InferOutput<typeof schema>;
/** Checks a clock sample. */
export function parseWallClockSample(
  value: unknown,
): Result<WallClockSample, PayloadError> {
  return parsePayload(schema, value);
}
