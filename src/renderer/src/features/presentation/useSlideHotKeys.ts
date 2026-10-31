import {
  useWindowShortcuts,
  type WindowShortcut,
} from '@renderer/platform/windowShortcuts';
import {hasSlideHotKey, outputHotKey} from '@renderer/session/show';

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
