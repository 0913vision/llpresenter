import * as v from 'valibot';
import {
  monitorEdidSchema,
  monitorIdentityPayloadSchema,
  type MonitorIdentity,
} from './monitorIdentity';
import {MONITOR_LIST_MAX} from './monitors';
import {payloadObject, parsePayload, type PayloadError} from './payload';
import type {Result} from '../common/result';

const NATIVE_TEXT_MAX = 512;
const COORDINATE_MAX = 1_000_000;
const text = v.pipe(v.string(), v.maxLength(NATIVE_TEXT_MAX));
const coordinate = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(-COORDINATE_MAX),
  v.maxValue(COORDINATE_MAX),
);
const size = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(1),
  v.maxValue(COORDINATE_MAX),
);
const snapshotSchema = payloadObject({
  paths: v.pipe(
    v.array(
      payloadObject({
        bounds: payloadObject({
          x: coordinate,
          y: coordinate,
          width: size,
          height: size,
        }),
        devicePath: text,
      }),
    ),
    v.maxLength(MONITOR_LIST_MAX),
  ),
  wmi: v.pipe(
    v.array(
      payloadObject({
        instanceName: text,
        manufacturer: text,
        product: text,
        serial: text,
      }),
    ),
    v.maxLength(MONITOR_LIST_MAX),
  ),
});

export interface NativeMonitorIdentity {
  readonly bounds: Readonly<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  readonly identity?: MonitorIdentity;
}

/** Joins only a recognized interface path to exactly one active WMI instance. */
export function parseWindowsMonitors(
  value: unknown,
): Result<readonly NativeMonitorIdentity[], PayloadError> {
  const parsed = parsePayload(snapshotSchema, value);
  if (!parsed.ok) return parsed;
  const monitors = parsed.value.paths.map(({bounds, devicePath}) => {
    const match = /^\\\\\?\\(DISPLAY#[^#]+#[^#]+)#\{[0-9a-f-]+\}$/i.exec(
      devicePath,
    );
    const instance = match?.[1]?.replaceAll('#', '\\').toUpperCase();
    const rows =
      instance === undefined
        ? []
        : parsed.value.wmi.filter(
            row =>
              row.instanceName.replace(/_\d+$/, '').toUpperCase() === instance,
          );
    const row = rows.length === 1 ? rows[0] : undefined;
    const hardwareId = match?.[1]?.split('#')[1]?.toUpperCase();
    const edid = v.safeParse(
      monitorEdidSchema,
      row !== undefined && hardwareId === `${row.manufacturer}${row.product}`
        ? row
        : undefined,
    );
    const identity = v.safeParse(monitorIdentityPayloadSchema, {
      kind: 'windows',
      devicePath,
      ...(edid.success ? {edid: edid.output} : {}),
    });
    return {bounds, ...(identity.success ? {identity: identity.output} : {})};
  });
  return {ok: true, value: monitors};
}
