import * as v from 'valibot';
import type {ReadonlyKnown} from '../common/fileFormat';
import {payloadObject} from '../common/payload';
import {jsonObject} from '../common/primitives';

/** The longest monitor device path in characters. */
export const MONITOR_DEVICE_PATH_MAX = 512;
/** The longest monitor serial in characters. */
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

/**
 * A monitor's identity as `screens.json` keeps it: its Windows device path
 * and, when the monitor reports a meaningful serial, its EDID. Unknown fields
 * stay.
 */
export const monitorIdentitySchema = jsonObject({
  ...entries,
  edid: v.exactOptional(jsonObject(edidEntries)),
});
/** A monitor's identity as it arrives over IPC; unknown fields are dropped. */
export const monitorIdentityPayloadSchema = payloadObject({
  ...entries,
  edid: v.exactOptional(payloadObject(edidEntries)),
});
/**
 * The EDID of a monitor: its manufacturer code, its product code, and its
 * serial.
 */
export const monitorEdidSchema = payloadObject(edidEntries);

/** Windows connection identity, strengthened by EDID when a meaningful serial exists. */
export type MonitorIdentity = ReadonlyKnown<
  v.InferOutput<typeof monitorIdentitySchema>
>;
