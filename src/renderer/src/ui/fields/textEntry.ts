/** Elements that take typed text, where editing keys belong to the field. */
export const TEXT_ENTRY_SELECTOR =
  'input, textarea, select, [contenteditable="true"]';

/** Inputs that are buttons or pickers: they take no typed text. */
const NON_TEXT_INPUTS = new Set([
  'checkbox',
  'radio',
  'button',
  'submit',
  'reset',
  'range',
  'color',
  'file',
  'image',
]);

/** Whether a key event's target is inside a text field. */
export function isInTextEntry(target: EventTarget | null): boolean {
  return (
    target instanceof Element && target.closest(TEXT_ENTRY_SELECTOR) !== null
  );
}

/**
 * Whether a key pressed at `target` belongs to a text box: one that takes typed
 * text, a select, or what is inside them. A focused text box always comes
 * first for its keys, so a list, grid or dialog around it that acts on keys
 * asks this before it takes one.
 */
export function textBoxHasKey(target: EventTarget | null): boolean {
  if (target instanceof HTMLInputElement && NON_TEXT_INPUTS.has(target.type)) {
    return false;
  }
  return isInTextEntry(target);
}
