let columnDragActive = false;

/** Records whether the operator is dragging a column gap right now. */
export function setColumnDragActive(active: boolean): void {
  columnDragActive = active;
}

/** While a drag is in progress it owns the keys, so the live keys stay inactive. */
export function isColumnDragActive(): boolean {
  return columnDragActive;
}
