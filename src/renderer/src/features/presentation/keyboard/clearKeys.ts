import {clearLayer, toggleItem, undoClear} from '@renderer/session/show/clear';
import {clearButtons} from '@core/live';
import type {WindowShortcut} from '@renderer/ui/keys/commandDispatcher';
import {useWindowShortcuts} from '@renderer/platform/shortcuts/windowShortcuts';

const commands: readonly WindowShortcut[] = [
  {id: 'item.stop', run: toggleItem},
  ...clearButtons.map(spec => ({
    id: spec.command,
    run: () => clearLayer(spec.target),
  })),
  {id: 'clear.undo', run: () => undoClear()},
];

/** Routes clear commands through recorder, IME, and repeat precedence. */
export function useClearKeys(): void {
  useWindowShortcuts(commands);
}
