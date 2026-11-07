import {createContext, useEffect, useSyncExternalStore} from 'react';

/** Tracks first reads within a view until their data or errors have rendered. */
export class LoadReadiness {
  private readonly pending = new Set<symbol>();
  private readonly listeners = new Set<() => void>();
  readonly getSnapshot = (): number => this.pending.size;
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  readonly begin = (): (() => void) => {
    const token = Symbol();
    this.pending.add(token);
    this.publish();
    return () => {
      if (this.pending.delete(token)) this.publish();
    };
  };
  private publish(): void {
    for (const listener of this.listeners) listener();
  }
}

export const LoadReadinessContext = createContext<LoadReadiness | null>(null);

/** Reports committed data and fonts; main paints the hidden native frame before reveal. */
export function usePaintedReadiness(
  readiness: LoadReadiness,
  onReady: (() => void) | undefined,
): void {
  const pending = useSyncExternalStore(
    readiness.subscribe,
    readiness.getSnapshot,
  );
  useEffect(() => {
    if (pending !== 0 || onReady === undefined) return undefined;
    let stopped = false;
    const draw = (): void => {
      if (!stopped && readiness.getSnapshot() === 0) onReady();
    };
    document.fonts.ready.then(draw, (error: unknown) => {
      window.llp?.log.write({
        level: 'error',
        message: 'Could not prepare settings fonts',
        detail: error instanceof Error ? error.message : String(error),
      });
      draw();
    });
    return () => {
      stopped = true;
    };
  }, [pending, onReady, readiness]);
}
