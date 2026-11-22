/** The element around this one that scrolls down, or null. */
export function scrollParent(element: HTMLElement | null): HTMLElement | null {
  let parent = element?.parentElement ?? null;
  while (
    parent !== null &&
    !['auto', 'scroll'].includes(getComputedStyle(parent).overflowY)
  ) {
    parent = parent.parentElement;
  }
  return parent;
}
