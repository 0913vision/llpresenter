import {OUTPUT_REVEAL_DEADLINE_MS} from '@core/output';

/** Wait for the incoming composition, bounded even when animation frames stop. */
export function waitForReady(
  ready: () => boolean,
  reveal: () => void,
  onDeadline: () => void,
): () => void {
  let active = true;
  let frame = 0;
  const cancel = (): void => {
    active = false;
    cancelAnimationFrame(frame);
    clearTimeout(timer);
  };
  const timer = setTimeout(() => {
    if (!active) return;
    cancel();
    onDeadline();
    reveal();
  }, OUTPUT_REVEAL_DEADLINE_MS);
  const check = (): void => {
    if (!active) return;
    if (!ready()) frame = requestAnimationFrame(check);
    else {
      cancel();
      reveal();
    }
  };
  frame = requestAnimationFrame(check);
  return cancel;
}
