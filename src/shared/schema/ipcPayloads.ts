import * as v from 'valibot';
import type {Result} from '../result';
import {parsePayload, type PayloadError} from './payload';

const MESSAGE_MAX_LENGTH = 500;
const DETAIL_MAX_LENGTH = 4000;
const FRAME_RATE_MAX = 240;

export const logLevels = ['info', 'warn', 'error'] as const;

export type LogLevel = (typeof logLevels)[number];

const rendererLogEntrySchema = v.object({
  level: v.picklist(logLevels),
  message: v.pipe(v.string(), v.minLength(1), v.maxLength(MESSAGE_MAX_LENGTH)),
  detail: v.exactOptional(v.pipe(v.string(), v.maxLength(DETAIL_MAX_LENGTH))),
});

const frameRateReportSchema = v.object({
  screenId: v.pipe(v.string(), v.nonEmpty()),
  fps: v.pipe(
    v.number(),
    v.finite(),
    v.minValue(0),
    v.maxValue(FRAME_RATE_MAX),
  ),
});

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
