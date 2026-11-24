import * as v from 'valibot';
import type {Result} from '@core/common/result';
import {
  parsePayload,
  payloadObject,
  type PayloadError,
} from '../common/payload';
import {slideTransitionSchema} from '../slides/slideTransition';

/** The highest frame rate a window may report. */
export const FRAME_RATE_MAX = 240;

/** The longest message and detail a renderer log entry may have. */
export const RENDERER_LOG_LIMITS = {message: 500, detail: 4000} as const;

/** The severities a renderer log entry may have, from least to most serious. */
export const logLevels = ['info', 'warn', 'error'] as const;

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

/** Checks a transition an output page sends to its presenter. */
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

/** Checks the sign of life of a static output. */
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

/**
 * An output window's report of its frame size in px and whether its frame is
 * drawn. `version` is the live state version the frame was drawn for.
 */
export type FrameReadyReport = Readonly<
  v.InferOutput<typeof frameReadyReportSchema>
>;

/** Checks an output window's frame report. */
export function parseFrameReadyReport(
  value: unknown,
): Result<FrameReadyReport, PayloadError> {
  return parsePayload(frameReadyReportSchema, value);
}

/** Checks main's answer to a frame report: true when the output may show. */
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

/** Checks a log line sent by a window. */
export function parseRendererLogEntry(
  value: unknown,
): Result<RendererLogEntry, PayloadError> {
  return parsePayload(rendererLogEntrySchema, value);
}

/** Whether the value is a valid log line of a window. */
export function isRendererLogEntry(value: unknown): value is RendererLogEntry {
  return parseRendererLogEntry(value).ok;
}

/** Checks an output window's frame rate report. */
export function parseFrameRateReport(
  value: unknown,
): Result<FrameRateReport, PayloadError> {
  return parsePayload(frameRateReportSchema, value);
}

/** Whether the value is a valid frame rate report. */
export function isFrameRateReport(value: unknown): value is FrameRateReport {
  return parseFrameRateReport(value).ok;
}
