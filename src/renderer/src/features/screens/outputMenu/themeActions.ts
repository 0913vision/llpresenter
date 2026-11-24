import {logFailure} from '@renderer/platform/logFailure';
import type {ThemeId} from '@core/schema/common/ids';
import {sendLive} from '@renderer/session/live';
import {type Notice, warningNotice} from '@renderer/ui/popups/notices';

/** Sends a theme choice without treating the request as live confirmation. */
export function sendThemeChange(
  themeId: ThemeId,
  onProblem: (notice: Notice) => void,
): void {
  try {
    sendLive({type: 'theme.set', themeId});
  } catch (cause) {
    logFailure(window.llp, 'Could not send the theme change command', cause);
    onProblem(warningNotice('theme:send', '테마 변경 실패'));
  }
}
