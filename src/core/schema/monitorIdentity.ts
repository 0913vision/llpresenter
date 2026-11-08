import * as v from 'valibot';
import type {ReadonlyKnown} from './fileFormat';
import {payloadObject} from './payload';
import {jsonObject} from './primitives';

export const MONITOR_DEVICE_PATH_MAX = 512;
export const MONITOR_SERIAL_MAX = 64;
const placeholders = new Set([
  'UNKNOWN',
  'NONE',
  'N/A',
  'DEFAULT',
  'SERIAL NUMBER',
]);

const serial = v.pipe(
  v.string(),
  v.minLength(1),
  v.maxLength(MONITOR_SERIAL_MAX),
  v.regex(/^[\x20-\x7e]+$/),
  v.check(value => {
    const normalized = value.trim().toUpperCase();
    return (
      normalized.length > 0 &&
      !/^0+$/.test(normalized) &&
      !placeholders.has(normalized)
    );
  }, 'Expected a meaningful monitor serial'),
);
const edidEntries = {
  manufacturer: v.pipe(v.string(), v.regex(/^[A-Z]{3}$/)),
  product: v.pipe(v.string(), v.regex(/^[0-9A-F]{4}$/)),
  serial,
};
const entries = {
  kind: v.literal('windows'),
  devicePath: v.pipe(
    v.string(),
    v.minLength(1),
    v.maxLength(MONITOR_DEVICE_PATH_MAX),
    v.regex(/^[\x20-\x7e]+$/),
    v.check(value => value.trim().length > 0, 'Expected a monitor device path'),
  ),
};

export const monitorIdentitySchema = jsonObject({
  ...entries,
  edid: v.exactOptional(jsonObject(edidEntries)),
});
export const monitorIdentityPayloadSchema = payloadObject({
  ...entries,
  edid: v.exactOptional(payloadObject(edidEntries)),
});
export const monitorEdidSchema = payloadObject(edidEntries);

/** Windows connection identity, strengthened by EDID when a meaningful serial exists. */
export type MonitorIdentity = ReadonlyKnown<
  v.InferOutput<typeof monitorIdentitySchema>
>;
