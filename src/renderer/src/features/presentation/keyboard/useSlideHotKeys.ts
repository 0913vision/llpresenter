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

export function useSlideHotKeys(): void {
  useWindowShortcuts(commands);
}
