/** Wait for two consecutive frames with a complete incoming composition. */
export function waitForPaint(
  ready: () => boolean,
  reveal: () => void,
): () => void {
  let active = true;
  let paints = 0;
  let frame = 0;
  const check = (): void => {
    if (!active) return;
    paints = ready() ? paints + 1 : 0;
    if (paints < 2) frame = requestAnimationFrame(check);
    else {
      active = false;
      reveal();
    }
  };
  frame = requestAnimationFrame(check);
  return () => {
    active = false;
    cancelAnimationFrame(frame);
  };
}
