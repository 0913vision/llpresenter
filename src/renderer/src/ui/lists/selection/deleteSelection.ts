/**
 * Deletes the chosen items at once as one step that 실행 취소 brings back,
 * when anything is chosen and the choice still stands.
 */
export function deleteSelection(
  count: number,
  valid: () => boolean,
  remove: () => void,
): void {
  if (count > 0 && valid()) remove();
}
