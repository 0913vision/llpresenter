import type {MediaLayer} from '../live/state';
import type {MediaItem} from '../schema/mediaList';
import type {MediaProgress} from '../schema/mediaProgress';

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
  const elapsed = backgroundElapsedSeconds(media, now);
  const positionSeconds =
    durationSeconds === null
      ? elapsed
      : media.loop
        ? elapsed % durationSeconds
        : Math.min(elapsed, durationSeconds);
  return {
    mediaId: media.mediaId,
    startedAt: media.startedAt,
    durationSeconds,
    positionSeconds,
  };
}
