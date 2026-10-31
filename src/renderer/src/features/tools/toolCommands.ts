import {
  createNoticeSetId,
  type NoticeSetId,
  type PropId,
} from '@core/schema/ids';
import type {Timer} from '@core/schema/timers';
import {MAX_LIVE_TIMERS} from '@core/schema/timerState';
import {sendLive, useLive} from '@renderer/session/live';

export function hideStageMessage(): void {
  if (useLive.getState().state?.stageMessage) {
    sendLive({type: 'stage.message.set', text: null});
  }
}

export function toggleNotice(noticeId: NoticeSetId): void {
  const active = useLive.getState().state?.layers.notice;
  if (active?.noticeId === noticeId && active.playback?.pausedAt === null) {
    sendLive({type: 'notice.pause'});
  } else {
    sendLive({type: 'notice.start', noticeId});
  }
}

export function toggleActiveNotice(): void {
  const active = useLive.getState().state?.layers.notice;
  if (!active) return;
  toggleNotice(createNoticeSetId(active.noticeId));
}

export function toggleProp(propId: PropId): void {
  const current = useLive.getState().state?.layers.prop;
  const on = current?.items
    ? current.items.some(item => item.propId === propId)
    : current?.propId === propId;
  sendLive({type: 'prop.set', propId, on: !on});
}

export function toggleTimer(
  timer: Timer,
  send: typeof sendLive = sendLive,
): void {
  if (timer.kind === 'clock') return;
  const timers = useLive.getState().state?.timers ?? {};
  const run = timers[timer.id];
  if (run === undefined && Object.keys(timers).length >= MAX_LIVE_TIMERS) {
    return;
  }
  send({
    type: run?.state === 'running' ? 'timer.pause' : 'timer.start',
    timerId: timer.id,
  });
}

export function resetTimer(
  timer: Timer,
  send: typeof sendLive = sendLive,
): void {
  if (
    timer.kind !== 'clock' &&
    useLive.getState().state?.timers?.[timer.id] !== undefined
  ) {
    send({type: 'timer.reset', timerId: timer.id});
  }
}
