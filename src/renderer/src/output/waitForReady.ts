/** Wait until the incoming composition has finished loading. */
export function waitForReady(
  ready: () => boolean,
  reveal: () => void,
): () => void {
  let active = true;
  let frame = 0;
  const check = (): void => {
    if (!active) return;
    if (!ready()) frame = requestAnimationFrame(check);
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
