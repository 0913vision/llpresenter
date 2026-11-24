let keyboardLast = true;

/**
 * Whether the last input in the window was a key press rather than a pointer.
 * True until the first input, so a menu keeps pointing its first row then.
 */
export function lastInputWasKeyboard(): boolean {
  return keyboardLast;
}

/**
 * Follows the input type in `target` until the returned function is called.
 * A menu opened from the keyboard points its first row; one opened with the
 * pointer points nothing, as in ProPresenter.
 */
export function watchInputModality(target: Window): () => void {
  const onKey = (): void => {
    keyboardLast = true;
  };
  const onPointer = (): void => {
    keyboardLast = false;
  };
  target.addEventListener('keydown', onKey, true);
  target.addEventListener('pointerdown', onPointer, true);
  return () => {
    target.removeEventListener('keydown', onKey, true);
    target.removeEventListener('pointerdown', onPointer, true);
    keyboardLast = true;
  };
}
