import type {MediaLayer} from '@core/schema/live/live';
import type {MediaItem} from '@core/schema/media/mediaList';
import type {MediaProgress} from '@core/schema/media/mediaProgress';

/** Elapsed source seconds on main's background timeline, including speed changes. */
export function backgroundElapsedSeconds(
  media: MediaLayer,
  now: number,
): number {
  return (
    (media.positionSeconds ?? 0) +
    (Math.max(0, now - media.startedAt) / 1000) * (media.properties?.speed ?? 1)
  );
}

/** Reads the current loop position, or the held end of a nonlooping video. */
export function backgroundProgress(
  media: MediaLayer | null,
  items: readonly MediaItem[],
  now: number,
): MediaProgress | null {
  if (media === null) return null;
  const item = items.find(item => item.id === media.mediaId);
  if (item?.kind !== 'video') return null;
  const durationSeconds =
    item.duration !== undefined && item.duration > 0 ? item.duration : null;
  const start = media.properties?.in ?? 0;
  const end = Math.min(
    media.properties?.out ?? Infinity,
    durationSeconds ?? Infinity,
  );
  const length = end - start;
  const elapsed = backgroundElapsedSeconds(media, now);
  const positionSeconds = !Number.isFinite(length)
    ? start + elapsed
    : media.loop && length > 0
      ? start + (elapsed % length)
      : Math.min(start + elapsed, end);
  return {
    mediaId: media.mediaId,
    startedAt: media.startedAt,
    durationSeconds,
    positionSeconds,
  };
}
