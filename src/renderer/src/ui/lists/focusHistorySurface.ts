/** Keep edit history focused without making a row or button consume live slide keys. */
export function focusHistorySurface(element: HTMLElement | null): void {
  if (!element) return;
  const original = element.getAttribute('tabindex');
  element.tabIndex = -1;
  element.focus({preventScroll: true});
  if (original === null) element.removeAttribute('tabindex');
  else element.setAttribute('tabindex', original);
}
