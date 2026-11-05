import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import {hideStageMessage} from './toolCommands';

/** Keeps live-state actions available after their editing panels unmount. */
export function useLiveStateShortcuts(): void {
  useWindowShortcuts([{id: 'stage.hideMessage', run: hideStageMessage}]);
}
