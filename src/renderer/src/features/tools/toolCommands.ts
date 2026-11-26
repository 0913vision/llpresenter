import {type PropId} from '@core/schema/common/ids';
import type {Timer} from '@core/schema/tools/timers';
import {sendLive, useLive} from '@renderer/session/live';

/** Takes the text off the 무대 screens, if one is shown. */
export function hideStageMessage(): void {
  if (useLive.getState().state?.stageMessage) {
    sendLive({type: 'stage.message.set', text: null});
  }
}

/**
 * Shows the 그래픽 `propId` if it is off air, and hides it if it is on, as
 * main has it, so a press made before the window hears the one before counts.
 */
export function toggleProp(propId: PropId): void {
  sendLive({type: 'prop.toggle', propId});
}

/**
 * Pauses a running 타이머 or starts one that is not running, as main has it;
 * clocks do nothing, and main starts none when as many timers run as may.
 */
export function toggleTimer(
  timer: Timer,
  send: typeof sendLive = sendLive,
): void {
  if (timer.kind === 'clock') return;
  send({type: 'timer.toggle', timerId: timer.id, off: 'pause'});
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
