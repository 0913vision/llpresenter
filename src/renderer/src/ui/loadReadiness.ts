import {createContext} from 'react';

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
