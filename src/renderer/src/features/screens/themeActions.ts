import type {ThemeId} from '@core/schema/ids';
import {sendLive} from '@renderer/session/live';
import {noticeTime, type Notice} from '@renderer/ui/notices';

/** Sends a theme choice without treating the request as live confirmation. */
export function sendThemeChange(
  themeId: ThemeId,
  onProblem: (notice: Notice) => void,
): void {
  try {
    sendLive({type: 'theme.set', themeId});
  } catch (cause) {
    window.llp?.log.write({
      level: 'error',
      message: 'Could not send the theme change command',
      detail: cause instanceof Error ? cause.message : String(cause),
    });
    onProblem({
      key: 'theme:send',
      kind: 'warning',
      icon: 'warning',
      title: '테마 변경 실패',
      time: noticeTime(),
    });
  }
}
