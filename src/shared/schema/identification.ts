import * as v from 'valibot';
import {parsePayload, payloadObject} from './payload';
import {MONITOR_NAME_MAX, MONITOR_REFRESH_RATE_MAX} from './monitors';

const dimension = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(1),
  v.maxValue(1_000_000),
);
const identificationSchema = payloadObject({
  name: v.pipe(v.string(), v.maxLength(MONITOR_NAME_MAX)),
  kind: v.nullable(v.picklist(['audience', 'stage'])),
  method: v.picklist(['fullscreen', 'window', 'capture', 'display']),
  width: dimension,
  height: dimension,
  refreshRate: v.pipe(
    v.number(),
    v.finite(),
    v.minValue(0),
    v.maxValue(MONITOR_REFRESH_RATE_MAX),
  ),
});

/** Bounded display details passed to the isolated Identify page. */
export type Identification = v.InferOutput<typeof identificationSchema>;

/** Validates the details decoded from an Identify window's URL. */
export function parseIdentification(value: unknown) {
  return parsePayload(identificationSchema, value);
}
