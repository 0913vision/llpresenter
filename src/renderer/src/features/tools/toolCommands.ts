import {type PropId} from '@core/schema/common/ids';
import type {Timer} from '@core/schema/tools/timers';
import {MAX_LIVE_TIMERS} from '@core/schema/tools/timerState';
import {sendLive, useLive} from '@renderer/session/live';

/** Takes the text off the 무대 screens, if one is shown. */
export function hideStageMessage(): void {
  if (useLive.getState().state?.stageMessage) {
    sendLive({type: 'stage.message.set', text: null});
  }
}

/** Shows the 그래픽 `propId` if it is off air, and hides it if it is on. */
export function toggleProp(propId: PropId): void {
  const current = useLive.getState().state?.layers.prop;
  const on = current?.items
    ? current.items.some(item => item.propId === propId)
    : current?.propId === propId;
  sendLive({type: 'prop.set', propId, on: !on});
}

/**
 * Pauses a running 타이머 or starts one that is not running; clocks do nothing,
 * and so does a start when as many timers run as may.
 */
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

/** Resets a 타이머 that has a run, not a clock. */
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
