import * as v from 'valibot';
import type {ReadonlyKnown} from './fileFormat';
import {audioSourceSchema} from './liveActions';
import {epochMillisecondsSchema} from './overlayState';
import {payloadObject} from './payload';
import {nonNegativeInteger, seconds} from './primitives';

export const audioPlaybackSchema = payloadObject({
  source: audioSourceSchema,
  trackVersion: v.pipe(nonNegativeInteger, v.maxValue(Number.MAX_SAFE_INTEGER)),
  positionSeconds: v.pipe(seconds, v.maxValue(Number.MAX_SAFE_INTEGER)),
  since: v.nullable(epochMillisecondsSchema),
});

/** A track anchored to main's monotonic clock; null `since` holds its position. */
export type AudioPlayback = ReadonlyKnown<
  v.InferOutput<typeof audioPlaybackSchema>
>;

export function audioPositionSeconds(
  playback: AudioPlayback,
  now: number,
): number {
  return (
    playback.positionSeconds +
    (playback.since === null ? 0 : Math.max(0, now - playback.since) / 1000)
  );
}
