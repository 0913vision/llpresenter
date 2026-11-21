const active = new Set<symbol>();

/** Tracks native presenter transitions that are currently drawing frames. */
export function setTransitionActivity(id: symbol, moving: boolean): void {
  if (moving) active.add(id);
  else active.delete(id);
}

/** Whether a native output is currently in a slide transition. */
export function outputTransitionActive(): boolean {
  return active.size > 0;
}
