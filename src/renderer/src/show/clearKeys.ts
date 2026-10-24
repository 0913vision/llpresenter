import {useEffect} from 'react';
import {clearLayer, undoClear} from '@renderer/state/clear';
import {clearButtons, type ClearCommandId} from './clear';

const UNDO_CODE = 'KeyZ';

/** The default key of each clear command, by command ID. */
const defaultCodes: ReadonlyMap<string, ClearCommandId> = new Map(
  clearButtons.map(spec => [spec.code, spec.command]),
);
const EDITABLE_SELECTOR = 'input, textarea, select, [contenteditable="true"]';

function isInEditableField(target: EventTarget | null): boolean {
  return (
    target instanceof Element && target.closest(EDITABLE_SELECTOR) !== null
  );
}

function hasAnyModifier(event: KeyboardEvent): boolean {
  return event.ctrlKey || event.altKey || event.metaKey || event.shiftKey;
}

function isUndoKey(event: KeyboardEvent): boolean {
  return (
    event.code === UNDO_CODE &&
    event.ctrlKey &&
    !event.altKey &&
    !event.metaKey &&
    !event.shiftKey
  );
}

function runClearCommand(command: ClearCommandId): void {
  const spec = clearButtons.find(button => button.command === command);
  if (spec) clearLayer(spec.target);
}

/**
 * Handles the clear keys: F1 to F7 clear a layer wherever the focus is, in a
 * text field too, and Ctrl Z undoes the last clear outside text fields. A held
 * key runs once, and its repeats are still swallowed.
 */
export function handleClearKey(event: KeyboardEvent): void {
  if (event.defaultPrevented) return;
  if (isUndoKey(event)) {
    if (isInEditableField(event.target)) return;
    event.preventDefault();
    if (!event.repeat) undoClear();
    return;
  }
  if (hasAnyModifier(event)) return;
  const command = defaultCodes.get(event.code);
  if (command === undefined) return;
  event.preventDefault();
  if (!event.repeat) runClearCommand(command);
}

/** Listens for the clear keys for as long as the control window is open. */
export function useClearKeys(): void {
  useEffect(() => {
    window.addEventListener('keydown', handleClearKey);
    return () => window.removeEventListener('keydown', handleClearKey);
  }, []);
}
