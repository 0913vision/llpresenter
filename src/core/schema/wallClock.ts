import * as v from 'valibot';
import {parsePayload, payloadObject, type PayloadError} from './payload';
import type {Result} from '@core/common/result';

const schema = payloadObject({
  wall: v.pipe(v.number(), v.finite()),
  monotonic: v.pipe(v.number(), v.finite()),
  timeZone: v.pipe(v.string(), v.nonEmpty(), v.maxLength(128)),
});
export type WallClockSample = v.InferOutput<typeof schema>;
export function parseWallClockSample(
  value: unknown,
): Result<WallClockSample, PayloadError> {
  return parsePayload(schema, value);
}
