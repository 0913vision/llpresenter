import {useWindowShortcuts} from '@renderer/platform/shortcuts/windowShortcuts';
import {hasSlideHotKey, outputHotKey} from '@renderer/session/show/show';
import {type WindowShortcut} from '@renderer/ui/keys/commandDispatcher';

const codes = [
  ...Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ', letter => `Key${letter}`),
  ...Array.from({length: 10}, (_, number) => `Digit${number}`),
];
const commands = codes.map<WindowShortcut>(code => ({
  id: `slide.${code}`,
  when: () => hasSlideHotKey(code),
  run: () => outputHotKey(code),
}));

/**
 * Registers the shortcuts of the slide commands for the window while it is
 * mounted.
 */
export function useSlideHotKeys(): void {
  useWindowShortcuts(commands);
}
