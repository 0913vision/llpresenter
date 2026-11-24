/** Elements that take typed text, where editing keys belong to the field. */
export const TEXT_ENTRY_SELECTOR =
  'input, textarea, select, [contenteditable="true"]';

/** Whether a key event's target is inside a text field. */
export function isInTextEntry(target: EventTarget | null): boolean {
  return (
    target instanceof Element && target.closest(TEXT_ENTRY_SELECTOR) !== null
  );
}
