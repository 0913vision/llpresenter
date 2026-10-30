import {
  useWindowShortcuts,
  type WindowShortcut,
} from '@renderer/platform/windowShortcuts';
import {
  hasSlideHotKey,
  outputHotKey,
} from '@renderer/features/presentation/state/show';
import {isComposingKey} from '@renderer/ui/ime';
import {isInTextEntry} from '@renderer/ui/textEntry';

const codes = [
  ...Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ', letter => ({
    code: `Key${letter}`,
    target: `Key${letter}`,
    numpad: false,
  })),
  ...Array.from({length: 10}, (_, number) => ({
    code: `Digit${number}`,
    target: `Digit${number}`,
    numpad: false,
  })),
  ...Array.from({length: 10}, (_, number) => ({
    code: `Numpad${number}`,
    target: `Digit${number}`,
    numpad: true,
  })),
];

const commands = codes.map<WindowShortcut>(key => ({
  code: key.code,
  when: event =>
    !isComposingKey(event) &&
    !isInTextEntry(event.target) &&
    (!key.numpad || event.getModifierState('NumLock')) &&
    hasSlideHotKey(key.target),
  run: () => {
    outputHotKey(key.target);
  },
}));

/** Routes per-slide keys through shared focus, IME, repeat and drag precedence. */
export function useSlideHotKeys(): void {
  useWindowShortcuts(commands);
}
