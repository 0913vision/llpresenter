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

function noticeIntervalMs(playback: NoticePlayback): number {
  return Math.max(MIN_INTERVAL_MS, playback.interval * MILLISECONDS_PER_SECOND);
}
