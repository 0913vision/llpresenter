/** Reads complete menu row order, including separators and checked items. */
export function renderedToolMenuRows(
  menu: HTMLElement,
): ReadonlyArray<string | null> {
  return [
    ...menu.querySelectorAll('[role^="menuitem"], [role="separator"]'),
  ].map(row =>
    row.getAttribute('role') === 'separator' ? '|' : row.textContent,
  );
}
