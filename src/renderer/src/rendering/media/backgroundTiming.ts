import type {MediaLayer} from '@core/schema/live/live';
import {backgroundElapsedSeconds} from '@core/media';

/** A background less than this far along starts from the beginning instead of seeking. */
export const MIN_SEEK_SECONDS = 0.5;

/**
 * How long a new video may take to show its first frame before it is shown
 * anyway.
 */
export const VIDEO_FRAME_DEADLINE_MS = 250;

/** How long a finished handover retains the previous player's resources. */
export const BACKGROUND_RELEASE_DELAY_MS = 1500;

/**
 * Where a background should be now: the time since it started, wrapped for a
 * loop and held at the end otherwise, so a window that loads late (a relaunch,
 * a screen turned on later) shows the same picture as the others
 * (docs/spec/03-output.md, playback).
 *
 * @returns The position in seconds, or 0 to start from the beginning.
 */
export function startOffsetSeconds(
  media: MediaLayer,
  duration: number,
  now: number,
): number {
  const offset = playbackOffsetSeconds(media, duration, now);
  return offset < MIN_SEEK_SECONDS && (media.properties?.in ?? 0) === 0
    ? 0
    : offset;
}

/** Where a background is now within its 시작 and 끝, in seconds. */
export function playbackOffsetSeconds(
  media: MediaLayer,
  duration: number,
  now: number,
): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  const start = Math.min(media.properties?.in ?? 0, duration);
  const end = Math.min(media.properties?.out ?? duration, duration);
  const length = Math.max(0, end - start);
  const elapsed = backgroundElapsedSeconds(media, now);
  return media.loop && length > 0
    ? start + (elapsed % length)
    : Math.min(start + elapsed, end);
}

/**
 * Whether a background that does not loop has played to its 끝, so it holds
 * its last picture instead of playing.
 */
export function backgroundAtEnd(
  media: MediaLayer | null,
  duration: number,
  now: number,
): boolean {
  return (
    media !== null &&
    !media.loop &&
    Number.isFinite(duration) &&
    duration > 0 &&
    backgroundElapsedSeconds(media, now) >=
      Math.max(
        0,
        Math.min(media.properties?.out ?? duration, duration) -
          (media.properties?.in ?? 0),
      )
  );
}
