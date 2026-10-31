import {clearLayer, toggleItem, undoClear} from '@renderer/session/clear';
import {clearButtons} from '@core/live/clear';
import {
  dispatchShortcut,
  type WindowShortcut,
} from '@renderer/ui/commandDispatcher';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';

const commands: readonly WindowShortcut[] = [
  {id: 'item.stop', run: toggleItem},
  ...clearButtons.map(spec => ({
    id: spec.command,
    run: () => clearLayer(spec.target),
  })),
  {id: 'clear.undo', run: () => undoClear()},
];

/** Routes clear commands through recorder, IME, and repeat precedence. */
export function handleClearKey(event: KeyboardEvent): void {
  dispatchShortcut(event, commands, 'capture');
}

export function useClearKeys(): void {
  useWindowShortcuts(commands);
}
