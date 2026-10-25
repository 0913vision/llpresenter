import type {KeyboardEvent} from 'react';

const IME_PROCESS_KEY = 'Process';

/**
 * Whether a key press belongs to an IME composition, such as Korean input
 * that isn't confirmed yet. The IME owns those keys, so a command must not run
 * on them: Enter confirms the text and Esc cancels it.
 */
export function isComposing(event: KeyboardEvent): boolean {
  return isComposingKey(event.nativeEvent);
}

/** The same check for a key event from the DOM, outside React. */
export function isComposingKey(event: globalThis.KeyboardEvent): boolean {
  return event.isComposing || event.key === IME_PROCESS_KEY;
}
