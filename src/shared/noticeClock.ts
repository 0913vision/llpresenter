import type {NoticePlayback} from './live';

export const MAX_OVERLAY_TIMER_MS = 2_147_483_647;
const MILLISECONDS_PER_SECOND = 1000;
const MIN_INTERVAL_MS = 1;

/** Pure main-clock arithmetic shared by the main process and renderer. */
export function noticePosition(playback: NoticePlayback, now: number): number {
  const elapsed = Math.max(0, (playback.pausedAt ?? now) - playback.startedAt);
  const steps = Math.floor(elapsed / noticeIntervalMs(playback));
  const position = playback.position + steps;
  return playback.loop
    ? position % playback.media.length
    : Math.min(playback.media.length - 1, position);
}

export function nextNoticeChange(
  playback: NoticePlayback,
  now: number,
): number | null {
  if (playback.pausedAt !== null || playback.media.length <= 1) return null;
  if (
    !playback.loop &&
    noticePosition(playback, now) === playback.media.length - 1
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
