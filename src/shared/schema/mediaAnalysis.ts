import * as v from 'valibot';
import type {PixelSize} from '../coverCrop';
import {parsePayload, plainObject} from './payload';
import {pixelCount, seconds} from './primitives';

/** The longest thumbnail the analysis page may answer, as a JPEG data URL. */
export const MAX_THUMBNAIL_DATA_URL_LENGTH = 512 * 1024;

/** The longest decoder message the analysis page may answer. */
export const MAX_ANALYSIS_MESSAGE_LENGTH = 500;

/** The thumbnail's data URL prefix: thumbnails are JPEG. */
export const THUMBNAIL_DATA_URL_PREFIX = 'data:image/jpeg;base64,';

/** Why the analysis page couldn't read a file, after the media error codes. */
export const analysisFailureReasons = [
  'aborted',
  'network',
  'decode',
  'unsupported',
] as const;

export type AnalysisFailureReason = (typeof analysisFailureReasons)[number];

/**
 * One file for the hidden analysis page (`docs/decisions.md`, "Media analysis
 * runs in a hidden renderer"): the URL it loads, how to read it, and the
 * thumbnail to draw, if any. Main builds it, so it isn't validated.
 */
export interface AnalysisJob {
  readonly url: string;
  readonly kind: 'video' | 'audio' | 'image';
  readonly thumbnail: PixelSize | null;
}

const analysisReplySchema = v.pipe(
  plainObject,
  v.variant('ok', [
    v.object({
      ok: v.literal(true),
      duration: v.exactOptional(seconds),
      width: v.exactOptional(pixelCount),
      height: v.exactOptional(pixelCount),
      thumbnail: v.exactOptional(
        v.pipe(
          v.string(),
          v.startsWith(THUMBNAIL_DATA_URL_PREFIX),
          v.maxLength(MAX_THUMBNAIL_DATA_URL_LENGTH),
        ),
      ),
    }),
    v.object({
      ok: v.literal(false),
      reason: v.picklist(analysisFailureReasons),
      message: v.pipe(v.string(), v.maxLength(MAX_ANALYSIS_MESSAGE_LENGTH)),
    }),
  ]),
);

/**
 * What the analysis page found: the duration of video and audio, the pixel
 * size of video and images, and the thumbnail it drew; or why the file can't
 * be read, which means the output can't play it either.
 */
export type AnalysisReply = v.InferOutput<typeof analysisReplySchema>;

/** Checks the analysis page's reply in main. Unknown fields are dropped. Never throws. */
export function parseAnalysisReply(value: unknown) {
  return parsePayload(analysisReplySchema, value);
}
