import {useEffect} from 'react';
import {clearLayer, undoClear} from '@renderer/state/clear';
import type {Workspace} from '@renderer/shell/Toolbar';
import {clearButtons, type ClearCommandId} from './clear';

const UNDO_CODE = 'KeyZ';

// NOTE(0913vision): Ctrl Z is the edit undo in 준비, so it undoes a clear only
// in the other workspaces (docs/spec/10-shortcuts-and-settings.md).
const undoWorkspaces: ReadonlySet<Workspace> = new Set(['show', 'screens']);

const defaultCodes: ReadonlyMap<string, ClearCommandId> = new Map(
  clearButtons.map(spec => [spec.code, spec.command]),
);

// NOTE(0913vision): A field that records a shortcut takes every key, F1 to F7
// included, because the operator opened it on purpose. The settings page marks
// it with this attribute while it records.
const SHORTCUT_RECORDER_SELECTOR = '[data-shortcut-recording]';
const TEXT_ENTRY_SELECTOR =
  'textarea, [contenteditable]:not([contenteditable="false"])';
const TEXT_INPUT_TYPES: ReadonlySet<string> = new Set([
  'text',
  'search',
  'url',
  'tel',
  'email',
  'password',
  'number',
  'date',
  'datetime-local',
  'month',
  'time',
  'week',
]);

function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest(TEXT_ENTRY_SELECTOR) !== null) return true;
  const input = target.closest('input');
  return input !== null && TEXT_INPUT_TYPES.has(input.type);
}

function isInShortcutRecorder(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest(SHORTCUT_RECORDER_SELECTOR) !== null
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
 * Handles the clear keys. F1 to F7 clear a layer wherever the focus is, in a
 * text field and during an IME composition too, except in a field that records
 * a shortcut. Ctrl Z undoes the last clear outside text entry, outside an IME
 * composition, and outside 준비. A held key runs once, and its repeats are
 * still swallowed.
 *
 * @param workspace - The workspace on screen.
 */
export function handleClearKey(
  event: KeyboardEvent,
  workspace: Workspace,
): void {
  if (event.defaultPrevented || isInShortcutRecorder(event.target)) return;
  if (isUndoKey(event)) {
    if (!undoWorkspaces.has(workspace)) return;
    if (event.isComposing || isTextEntry(event.target)) return;
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

/**
 * Listens for the clear keys for as long as the control window is open. The
 * listener runs in the capture phase, so no field or popup handler below it can
 * swallow F1 to F7 first.
 */
export function useClearKeys(workspace: Workspace): void {
  useEffect(() => {
    const listener = (event: KeyboardEvent): void =>
      handleClearKey(event, workspace);
    window.addEventListener('keydown', listener, {capture: true});
    return () =>
      window.removeEventListener('keydown', listener, {capture: true});
  }, [workspace]);
}
