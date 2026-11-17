import * as v from 'valibot';
import type {Result} from '../common/result';
import {parsePayload, payloadObject, type PayloadError} from './payload';
import {slideTransitionSchema} from './slideTransition';

/** The highest frame rate a window may report. */
export const FRAME_RATE_MAX = 240;

/** The longest message and detail a renderer log entry may have. */
export const RENDERER_LOG_LIMITS = {message: 500, detail: 4000} as const;

export const logLevels = ['info', 'warn', 'error'] as const;

export type LogLevel = (typeof logLevels)[number];

const rendererLogEntrySchema = payloadObject({
  level: v.picklist(logLevels),
  message: v.pipe(
    v.string(),
    v.minLength(1),
    v.maxLength(RENDERER_LOG_LIMITS.message),
  ),
  detail: v.exactOptional(
    v.pipe(v.string(), v.maxLength(RENDERER_LOG_LIMITS.detail)),
  ),
});

const frameRateReportSchema = payloadObject({
  screenId: v.pipe(v.string(), v.nonEmpty()),
  fps: v.pipe(
    v.number(),
    v.finite(),
    v.minValue(0),
    v.maxValue(FRAME_RATE_MAX),
  ),
});

const presenterTransitionSchema = payloadObject({
  screenId: v.pipe(v.string(), v.nonEmpty(), v.maxLength(200)),
  transition: slideTransitionSchema,
});

/** A slide transition an output page hands to the presenter of its monitor. */
export type PresenterTransition = Readonly<
  v.InferOutput<typeof presenterTransitionSchema>
>;

export function parsePresenterTransition(
  value: unknown,
): Result<PresenterTransition, PayloadError> {
  return parsePayload(presenterTransitionSchema, value);
}

const outputHealthReportSchema = payloadObject({
  screenId: v.pipe(v.string(), v.nonEmpty(), v.maxLength(200)),
});

/** A static output's sign of life, without a measured frame rate. */
export type OutputHealthReport = Readonly<
  v.InferOutput<typeof outputHealthReportSchema>
>;

export function parseOutputHealthReport(
  value: unknown,
): Result<OutputHealthReport, PayloadError> {
  return parsePayload(outputHealthReportSchema, value);
}

const frameReadyReportSchema = payloadObject({
  width: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(65_536)),
  height: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(65_536)),
  ready: v.boolean(),
  screenId: v.pipe(v.string(), v.nonEmpty(), v.maxLength(200)),
  version: v.pipe(
    v.number(),
    v.integer(),
    v.minValue(0),
    v.maxValue(Number.MAX_SAFE_INTEGER),
  ),
});

export type FrameReadyReport = Readonly<
  v.InferOutput<typeof frameReadyReportSchema>
>;

export function parseFrameReadyReport(
  value: unknown,
): Result<FrameReadyReport, PayloadError> {
  return parsePayload(frameReadyReportSchema, value);
}

export function parseFrameReadyReply(
  value: unknown,
): Result<boolean, PayloadError> {
  return parsePayload(v.boolean(), value);
}

/**
 * A log line from a window. Output windows never show errors; they send them
 * here. `detail` holds an error stack as text.
 */
export type RendererLogEntry = Readonly<
  v.InferOutput<typeof rendererLogEntrySchema>
>;

/** The frame rate an output window measured over the last second. */
export type FrameRateReport = Readonly<
  v.InferOutput<typeof frameRateReportSchema>
>;

export function parseRendererLogEntry(
  value: unknown,
): Result<RendererLogEntry, PayloadError> {
  return parsePayload(rendererLogEntrySchema, value);
}

export function isRendererLogEntry(value: unknown): value is RendererLogEntry {
  return parseRendererLogEntry(value).ok;
}

export function parseFrameRateReport(
  value: unknown,
): Result<FrameRateReport, PayloadError> {
  return parsePayload(frameRateReportSchema, value);
}

export function isFrameRateReport(value: unknown): value is FrameRateReport {
  return parseFrameRateReport(value).ok;
}

export const openWindowFailures = [
  'not-implemented',
  'no-such-target',
  'failed',
] as const;

export type OpenWindowFailure = (typeof openWindowFailures)[number];

/** Whether main opened the window, or why it didn't. */
export type OpenWindowResult = Result<
  void,
  {readonly reason: OpenWindowFailure}
>;

const openWindowResultSchema = v.variant('ok', [
  v.object({ok: v.literal(true), value: v.optional(v.undefined())}),
  v.object({
    ok: v.literal(false),
    error: v.object({reason: v.picklist(openWindowFailures)}),
  }),
]);

export function parseOpenWindowResult(
  value: unknown,
): Result<OpenWindowResult, PayloadError> {
  const checked = parsePayload(openWindowResultSchema, value);
  if (!checked.ok) return checked;
  return {
    ok: true,
    value: checked.value.ok
      ? {ok: true, value: undefined}
      : {ok: false, error: {reason: checked.value.error.reason}},
  };
}

/** The answer of a window request that fails its check. */
export function refuseOpenWindow(): OpenWindowResult {
  return {ok: false, error: {reason: 'failed'}};
}
