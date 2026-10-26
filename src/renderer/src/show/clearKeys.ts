import {useEffect} from 'react';
import {clearLayer} from '@renderer/state/clear';
import {SHORTCUT_RECORDING_SELECTOR} from '@renderer/ui';
import {clearButtons, type ClearCommandId} from './clear';

const defaultCodes: ReadonlyMap<string, ClearCommandId> = new Map(
  clearButtons.map(spec => [spec.code, spec.command]),
);

// NOTE(0913vision): A field that records a shortcut takes every key, F1 to F7
// included, because the operator opened it on purpose.
function isInShortcutRecorder(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest(SHORTCUT_RECORDING_SELECTOR) !== null
  );
}

function hasAnyModifier(event: KeyboardEvent): boolean {
  return event.ctrlKey || event.altKey || event.metaKey || event.shiftKey;
}

function runClearCommand(command: ClearCommandId): void {
  const spec = clearButtons.find(button => button.command === command);
  if (spec) clearLayer(spec.target);
}

/**
 * Handles the clear keys. F1 to F7 clear a layer wherever the focus is, in a
 * text field and during an IME composition too, except in a field that records
 * a shortcut. A held key runs once, and its repeats are still swallowed. A key
 * clears again after new output content, otherwise a second press restores
 * that key's captured content.
 */
export function handleClearKey(event: KeyboardEvent): void {
  if (event.defaultPrevented || isInShortcutRecorder(event.target)) return;
  if (hasAnyModifier(event)) return;
  const command = defaultCodes.get(event.code);
  if (command === undefined) return;
  event.preventDefault();
  if (!event.repeat) runClearCommand(command);
}

/**
 * Listens for the clear keys for as long as the control window is open. The
 * listener runs in the capture phase, so no field or popup handler below it can
 * swallow F1 to F7 first.
 */
export function useClearKeys(): void {
  useEffect(() => {
    window.addEventListener('keydown', handleClearKey, {capture: true});
    return () =>
      window.removeEventListener('keydown', handleClearKey, {capture: true});
  }, []);
}
