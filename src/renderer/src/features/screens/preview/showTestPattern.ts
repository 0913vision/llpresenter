import type {ScreenId} from '@core/schema/common/ids';
import {sendLive} from '@renderer/session/live';

/** Shows the pattern on the chosen screen and enables its output. */
export function showTestPattern(screenId: ScreenId): void {
  sendLive({
    type: 'live.batch',
    commands: [
      {type: 'output.set', screenId, on: true},
      {type: 'screen.testPattern.set', screenId, on: true},
    ],
  });
}
