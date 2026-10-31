import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import {hideStageMessage, toggleActiveNotice} from './toolCommands';

/** Keeps live-state actions available after their editing panels unmount. */
export function useLiveStateShortcuts(): void {
  useWindowShortcuts([
    {id: 'notice.pauseResume', run: toggleActiveNotice},
    {id: 'stage.hideMessage', run: hideStageMessage},
  ]);
}
