/**
 * What a text box shows: its live value, not the `value` attribute it started
 * with. The text fields write their value into the box (useTypedValue), so
 * the attribute does not follow typing.
 */
export function fieldValue(element: Element): string {
  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement
  ) {
    return element.value;
  }
  throw new Error(`${element.tagName} is not a text box`);
}
