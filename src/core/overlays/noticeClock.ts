import type {NoticePlayback} from '../live/state';

export const MAX_OVERLAY_TIMER_MS = 2_147_483_647;
const MILLISECONDS_PER_SECOND = 1000;
const MIN_INTERVAL_MS = 1;

/**
 * The images after the shown one, in the order the clock visits them, without
 * the ids that left the library (spec 08, "Deleting a media item that is in
 * use"). The image on screen at the start stays until its interval ends even
 * when it is gone; later rounds skip it.
 */
function followingPositions(playback: NoticePlayback): readonly number[] {
  const gone = new Set(playback.gone);
  const count = playback.media.length;
  const order = playback.loop
    ? Array.from(
        {length: count},
        (_, step) => (playback.position + 1 + step) % count,
      )
    : Array.from(
        {length: count - 1 - playback.position},
        (_, step) => playback.position + 1 + step,
      );
  return order.filter(index => {
    const id = playback.media[index];
    return id === undefined || !gone.has(id);
  });
}

/** Pure main-clock arithmetic shared by the main process and renderer. */
export function noticePosition(playback: NoticePlayback, now: number): number {
  const elapsed = Math.max(0, (playback.pausedAt ?? now) - playback.startedAt);
  const steps = Math.floor(elapsed / noticeIntervalMs(playback));
  if (steps === 0) return playback.position;
  const following = followingPositions(playback);
  if (following.length === 0) return playback.position;
  const index = playback.loop
    ? (steps - 1) % following.length
    : Math.min(steps, following.length) - 1;
  return following[index] ?? playback.position;
}

export function nextNoticeChange(
  playback: NoticePlayback,
  now: number,
): number | null {
  if (playback.pausedAt !== null || playback.media.length <= 1) return null;
  const following = followingPositions(playback);
  const shown = noticePosition(playback, now);
  if (
    following.length === 0 ||
    (playback.loop && following.length === 1 && following[0] === shown) ||
    (!playback.loop && shown === following[following.length - 1])
  ) {
    return null;
  }
  const intervalMs = noticeIntervalMs(playback);
  const elapsed = Math.max(0, now - playback.startedAt);
  return Math.max(MIN_INTERVAL_MS, intervalMs - (elapsed % intervalMs));
}

/**
 * The run of a 공지 as of its reference time (the pause, or `now` while it
 * runs), started again at the image on screen: `position` is that image and
 * `startedAt` keeps the time left in its interval, so the next change falls on
 * the same boundary as before. A refresh of a running 공지 applies it first, so
 * a longer `gone` list can never move the clock to another image (spec 08).
 */
export function rebaseNotice(
  playback: NoticePlayback,
  now: number,
): {readonly position: number; readonly startedAt: number} {
  const reference = playback.pausedAt ?? now;
  const elapsed = Math.max(0, reference - playback.startedAt);
  return {
    position: noticePosition(playback, reference),
    startedAt: reference - (elapsed % noticeIntervalMs(playback)),
  };
}

/**
 * Milliseconds until a running 공지 whose every image left the library ends:
 * the image on screen keeps the rest of its interval, then the 공지 stops
 * (spec 08, "Deleting a media item that is in use"). `null` while paused, and
 * for a 공지 that still has an image to show.
 */
export function noticeStopDelay(
  playback: NoticePlayback,
  now: number,
): number | null {
  if (playback.pausedAt !== null) return null;
  const gone = new Set(playback.gone);
  if (!playback.media.every(id => gone.has(id))) return null;
  const intervalMs = noticeIntervalMs(playback);
  const elapsed = Math.max(0, now - playback.startedAt);
  return Math.max(MIN_INTERVAL_MS, intervalMs - (elapsed % intervalMs));
}

function noticeIntervalMs(playback: NoticePlayback): number {
  return Math.max(MIN_INTERVAL_MS, playback.interval * MILLISECONDS_PER_SECOND);
}
