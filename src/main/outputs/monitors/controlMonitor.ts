/** Observes control-monitor changes without replanning on every move event. */
export function watchControlMonitor({
  control,
  monitorId,
  displays,
  changed,
}: {
  readonly control: {
    on(event: 'move' | 'resize', listener: () => void): unknown;
    removeListener(event: 'move' | 'resize', listener: () => void): unknown;
  };
  readonly monitorId: () => number | null;
  readonly displays: {subscribe(listener: () => void): () => void};
  readonly changed: () => void;
}): () => void {
  let previous = monitorId();
  const unsubscribe = displays.subscribe(() => {
    previous = monitorId();
  });
  let pending: ReturnType<typeof setTimeout> | null = null;
  const moved = (): void => {
    if (pending !== null) return;
    pending = setTimeout(() => {
      pending = null;
      const next = monitorId();
      if (next === previous) return;
      previous = next;
      changed();
    }, 0);
  };
  control.on('move', moved);
  control.on('resize', moved);
  return () => {
    unsubscribe();
    control.removeListener('move', moved);
    control.removeListener('resize', moved);
    if (pending !== null) clearTimeout(pending);
    pending = null;
  };
}
