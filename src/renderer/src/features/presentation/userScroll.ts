/**
 * Follows the operator moving a scrolled view by hand: each wheel turn, and a
 * drag that starts on the view itself (its scroll bar) or by touch, at press,
 * move and release. A grid that follows the live slide waits while it lasts.
 *
 * @returns A function that stops following.
 */
export function watchUserScroll(
  viewport: HTMLElement,
  {
    moved,
    dragging,
  }: {
    /** The operator moved the view, or is moving it. */
    readonly moved: () => void;
    /** A drag of the view started or ended. */
    readonly dragging: (on: boolean) => void;
  },
): () => void {
  let held = false;
  const down = (event: PointerEvent): void => {
    if (event.target !== viewport && event.pointerType !== 'touch') return;
    held = true;
    dragging(true);
    moved();
  };
  const move = (): void => {
    if (held) moved();
  };
  const up = (): void => {
    if (!held) return;
    held = false;
    dragging(false);
    moved();
  };
  viewport.addEventListener('wheel', moved, {passive: true});
  viewport.addEventListener('pointerdown', down);
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
  return () => {
    viewport.removeEventListener('wheel', moved);
    viewport.removeEventListener('pointerdown', down);
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
  };
}
