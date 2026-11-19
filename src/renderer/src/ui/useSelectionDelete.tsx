/** Apply a current selection as one undoable deletion, without a dialog. */
export function deleteSelection(
  count: number,
  valid: () => boolean,
  remove: () => void,
): void {
  if (count > 0 && valid()) remove();
}

export function useSelectionDelete() {
  return {ask: deleteSelection, dialog: null};
}
