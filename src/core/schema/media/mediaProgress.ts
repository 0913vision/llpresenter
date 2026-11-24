import * as v from 'valibot';
import {parsePayload, payloadObject} from '../common/payload';
import {seconds} from '../common/primitives';

const mediaProgressSchema = v.nullable(
  v.pipe(
    payloadObject({
      mediaId: v.pipe(v.string(), v.nonEmpty()),
      startedAt: v.pipe(v.number(), v.finite()),
      positionSeconds: seconds,
      durationSeconds: v.nullable(
        v.pipe(seconds, v.minValue(Number.MIN_VALUE)),
      ),
    }),
    v.check(
      value =>
        value.durationSeconds === null ||
        value.positionSeconds <= value.durationSeconds,
      'Expected position within the video duration',
    ),
  ),
);

/**
 * Where the background video on output is: its media id, when it started on
 * the main clock, its position, and its duration in seconds, null while
 * unknown.
 */
export type MediaProgress = Readonly<
  NonNullable<v.InferOutput<typeof mediaProgressSchema>>
>;
/**
 * Checks a progress reading that arrived over IPC; null means no video is
 * playing.
 */
export const parseMediaProgress = (value: unknown) =>
  parsePayload(mediaProgressSchema, value);
