import type {LookId} from '@core/schema/ids';
import {sendLive} from '@renderer/state/live';
import {noticeTime, type Notice} from '@renderer/ui/notices';

/** Sends a Look change and reports a transport failure through its host. */
export function sendLookChange(
  lookId: LookId,
  onProblem: (notice: Notice) => void,
): void {
  try {
    sendLive({type: 'look.set', lookId});
  } catch (cause) {
    window.llp?.log.write({
      level: 'error',
      message: 'Could not send the Look change command',
      detail: cause instanceof Error ? cause.message : String(cause),
    });
    onProblem({
      key: 'toolbar-look:send',
      kind: 'warning',
      icon: 'warning',
      title: 'Look 변경 실패',
      time: noticeTime(),
    });
  }
}
