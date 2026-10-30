import * as v from 'valibot';
import type {Result} from '../common/result';
import {FRAME_RATE_MAX} from './ipcPayloads';
import {
  parsePayload,
  payloadObject,
  plainObject,
  type PayloadError,
} from './payload';

/**
 * Where a screen's output shows: `off`, `fullscreen` on its monitor, in a
 * `window`, or `monitorMissing` while its monitor is gone.
 */
export const outputPlacements = [
  'off',
  'fullscreen',
  'window',
  'monitorMissing',
] as const;

/**
 * The state of a screen's output window: `running`, `restarting` after its
 * renderer died, or `limited` while the restart limit holds and it shows the
 * screen's empty picture (spec 08, "The restart limit").
 */
export const outputRendererStates = [
  'running',
  'restarting',
  'limited',
] as const;

const screenId = v.pipe(v.string(), v.nonEmpty());

/** The highest monitor number a status may report, far above any real setup. */
export const MONITOR_NUMBER_MAX = 64;

const outputScreenStatusSchema = payloadObject({
  placement: v.picklist(outputPlacements),
  renderer: v.picklist(outputRendererStates),
  fps: v.nullable(
    v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(FRAME_RATE_MAX)),
  ),
  fpsLow: v.boolean(),
  monitor: v.exactOptional(
    v.pipe(
      v.number(),
      v.integer(),
      v.minValue(1),
      v.maxValue(MONITOR_NUMBER_MAX),
    ),
  ),
});

const outputStatusesSchema = v.pipe(
  plainObject,
  v.record(screenId, outputScreenStatusSchema),
);

const outputScreenRequestSchema = payloadObject({screenId});

/**
 * How one screen's output is doing. `fps` is the frame rate its window
 * measured over the last second, or `null` before the first report or while it
 * is off. `fpsLow` is set when the main process judges that rate too low.
 * `monitor` is the number (from 1, as 화면 설정 counts) of the monitor the
 * screen last showed full screen on, kept after that monitor disconnects, and
 * absent when it never had one.
 */
export type OutputScreenStatus = Readonly<
  v.InferOutput<typeof outputScreenStatusSchema>
>;

/** The status of every screen, by screen id. */
export type OutputStatuses = Readonly<Record<string, OutputScreenStatus>>;

/** A request about one screen's output window. */
type OutputScreenRequest = Readonly<
  v.InferOutput<typeof outputScreenRequestSchema>
>;

/** 다시 시도 for a screen whose output window hit the restart limit. */
export type OutputRetryRequest = OutputScreenRequest;

/** 창 보기 for a screen whose output shows in a fallback window. */
export type OutputShowWindowRequest = OutputScreenRequest;

/** Checks an `output:status:get` reply or an `output:status:changed` push. */
export function parseOutputStatuses(
  value: unknown,
): Result<OutputStatuses, PayloadError> {
  return parsePayload(outputStatusesSchema, value);
}

/** Checks an `output:retry` request. */
export function parseOutputRetryRequest(
  value: unknown,
): Result<OutputRetryRequest, PayloadError> {
  return parsePayload(outputScreenRequestSchema, value);
}

/** Checks an `output:show-window` request. */
export function parseOutputShowWindowRequest(
  value: unknown,
): Result<OutputShowWindowRequest, PayloadError> {
  return parsePayload(outputScreenRequestSchema, value);
}
