import type {NoticePlayback} from '@shared/live';

export const MAX_OVERLAY_TIMER_MS = 2_147_483_647;

/** Pure main-clock arithmetic, also used by the renderer without platform APIs. */
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
  return Math.max(1, intervalMs - (elapsed % intervalMs));
}

function noticeIntervalMs(playback: NoticePlayback): number {
  return Math.max(1, playback.interval * 1000);
}
