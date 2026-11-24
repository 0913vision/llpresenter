import {createContext, useEffect, useSyncExternalStore} from 'react';

/** What a view waits for: data, or a picture. */
export type LoadKind = 'read' | 'picture';

/** How many loads of a kind have settled, of those that have begun. */
export interface LoadCount {
  readonly done: number;
  readonly total: number;
}

/** Tracks first reads within a view until their data or errors have rendered. */
export class LoadReadiness {
  private readonly pending = new Map<symbol, LoadKind>();
  private readonly begun = {read: 0, picture: 0};
  private readonly listeners = new Set<() => void>();
  /** How many loads have not settled. */
  readonly getSnapshot = (): number => this.pending.size;
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  readonly begin = (kind: LoadKind = 'read'): (() => void) => {
    const token = Symbol();
    this.pending.set(token, kind);
    this.begun[kind]++;
    this.publish();
    return () => {
      if (this.pending.delete(token)) this.publish();
    };
  };

  count(kind: LoadKind): LoadCount {
    const total = this.begun[kind];
    const waiting = [...this.pending.values()].filter(of => of === kind);
    return {done: total - waiting.length, total};
  }

  private publish(): void {
    for (const listener of this.listeners) listener();
  }
}

/** The load counter of the window a view reports to; null outside one. */
export const LoadReadinessContext = createContext<LoadReadiness | null>(null);

/** Reports committed data and fonts without requiring a hidden window to paint. */
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
