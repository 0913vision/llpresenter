import * as v from 'valibot';
import type {Result} from '../common/result';
import {serviceIdSchema, serviceItemIdSchema, songIdSchema} from './ids';
import {parsePayload, payloadObject, type PayloadError} from './payload';

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

const songItemTargetSchema = payloadObject({
  serviceId: serviceIdSchema,
  itemId: serviceItemIdSchema,
});

/** What the 곡 편집 window can start with besides the song. */
export const songEditorActions = ['hot-key'] as const;

export type SongEditorWindowAction = (typeof songEditorActions)[number];

/** The most slides a window can be asked to select. */
export const SONG_EDITOR_BLOCK_MAX = 100_000;

const songEditorTargetSchema = payloadObject({
  songId: songIdSchema,
  block: v.exactOptional(
    v.pipe(
      v.number(),
      v.integer(),
      v.minValue(0),
      v.maxValue(SONG_EDITOR_BLOCK_MAX),
    ),
  ),
  action: v.exactOptional(v.picklist(songEditorActions)),
  from: v.exactOptional(songItemTargetSchema),
  focusTitle: v.exactOptional(v.boolean()),
});

/**
 * The song, and where in it, that the 곡 편집 window opens. `from` names the
 * 예배 순서 item it was opened from, which 다른 이름으로 저장 switches.
 * `focusTitle` puts the cursor in the title field, for a song just made.
 */
export type SongEditorTarget = Readonly<
  v.InferOutput<typeof songEditorTargetSchema>
>;

export function parseSongEditorTarget(
  value: unknown,
): Result<SongEditorTarget, PayloadError> {
  return parsePayload(songEditorTargetSchema, value);
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
