import * as v from 'valibot';
import type {ReadonlyKnown} from '../common/fileFormat';
import {audioSourceSchema} from '../live/liveActions';
import {epochMillisecondsSchema} from '../live/overlayState';
import {payloadObject} from '../common/payload';
import {nonNegativeInteger, seconds} from '../common/primitives';

export const audioPlaybackSchema = payloadObject({
  source: audioSourceSchema,
  trackVersion: v.pipe(nonNegativeInteger, v.maxValue(Number.MAX_SAFE_INTEGER)),
  positionSeconds: v.pipe(seconds, v.maxValue(Number.MAX_SAFE_INTEGER)),
  since: v.nullable(epochMillisecondsSchema),
  fadeOutSince: v.exactOptional(epochMillisecondsSchema),
});

/** A track anchored to main's monotonic clock; null `since` holds its position. */
export type AudioPlayback = ReadonlyKnown<
  v.InferOutput<typeof audioPlaybackSchema>
>;

/**
 * Where the track is now, in seconds: its saved position plus the time since
 * `since` at `speed`, or the saved position alone while it is held.
 */
export function audioPositionSeconds(
  playback: AudioPlayback,
  now: number,
  speed = 1,
): number {
  return (
    playback.positionSeconds +
    (playback.since === null
      ? 0
      : (Math.max(0, now - playback.since) / 1000) * speed)
  );
}
