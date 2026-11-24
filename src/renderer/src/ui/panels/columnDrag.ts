let active = false;

/**
 * Notes that a column divider drag started or ended. While it runs, the window
 * shortcuts wait, so a key pressed mid-drag can't act on a half-sized layout.
 */
export function setColumnDragActive(next: boolean): void {
  active = next;
}

/** Whether a column divider is being dragged now. */
export function isColumnDragActive(): boolean {
  return active;
}
