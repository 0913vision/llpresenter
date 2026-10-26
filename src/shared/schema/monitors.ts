import * as v from 'valibot';
import type {Result} from '../result';
import {MONITOR_NUMBER_MAX} from './outputStatus';
import {parsePayload, payloadObject, type PayloadError} from './payload';

/** How many monitors one list may hold, the highest monitor number. */
export const MONITOR_LIST_MAX = MONITOR_NUMBER_MAX;

/** The longest monitor name a list may carry, in characters. */
export const MONITOR_NAME_MAX = 200;

/** The highest refresh rate a monitor may report, in hertz. */
export const MONITOR_REFRESH_RATE_MAX = 1000;

/** The highest scale factor a monitor may report. */
export const MONITOR_SCALE_FACTOR_MAX = 10;

const COORDINATE_LIMIT = 1_000_000;

const coordinate = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(-COORDINATE_LIMIT),
  v.maxValue(COORDINATE_LIMIT),
);

const extent = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(1),
  v.maxValue(COORDINATE_LIMIT),
);

const monitorInfoSchema = payloadObject({
  number: v.pipe(
    v.number(),
    v.integer(),
    v.minValue(1),
    v.maxValue(MONITOR_NUMBER_MAX),
  ),
  name: v.pipe(v.string(), v.maxLength(MONITOR_NAME_MAX)),
  bounds: payloadObject({
    x: coordinate,
    y: coordinate,
    width: extent,
    height: extent,
  }),
  scaleFactor: v.pipe(
    v.number(),
    v.finite(),
    v.gtValue(0),
    v.maxValue(MONITOR_SCALE_FACTOR_MAX),
  ),
  refreshRate: v.pipe(
    v.number(),
    v.finite(),
    v.minValue(0),
    v.maxValue(MONITOR_REFRESH_RATE_MAX),
  ),
  hasMainWindow: v.boolean(),
});

const monitorListSchema = v.pipe(
  v.array(monitorInfoSchema),
  v.maxLength(MONITOR_LIST_MAX),
);

/**
 * A connected monitor as 화면 설정 shows it. `number` counts from 1, left to
 * right, then top to bottom. `bounds` are in
 * device-independent pixels, as Electron reports them. `refreshRate` is
 * in hertz, and 0 when the system doesn't report one. `hasMainWindow` is set
 * on the monitor that holds the control window.
 */
export type MonitorInfo = Readonly<v.InferOutput<typeof monitorInfoSchema>>;

/** Every connected monitor in number order, at most {@link MONITOR_LIST_MAX}. */
export type MonitorList = readonly MonitorInfo[];

/** Checks a `monitors:get` reply or a `monitors:changed` push. */
export function parseMonitorList(
  value: unknown,
): Result<MonitorList, PayloadError> {
  return parsePayload(monitorListSchema, value);
}
