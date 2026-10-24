import type {LiveCommand} from '@shared/commands';
import {emptyLiveState, type LiveState} from '@shared/live';
import type {Logger} from '../log';
import {applyCommand, initialHistory, type LiveHistory} from './reducer';

export type LiveListener = (state: LiveState) => void;

/**
 * The single source of truth for the live state. It doesn't depend on
 * Electron; the IPC layer subscribes to it to reach the windows.
 */
export class LiveStore {
  private history: LiveHistory;
  private readonly listeners = new Set<LiveListener>();

  /**
   * Starts from the initial state.
   *
   * @param now - The clock that stamps commands; tests pass a fixed one.
   */
  constructor(
    initial: LiveState = emptyLiveState(),
    private readonly now: () => number = Date.now,
  ) {
    this.history = initialHistory(initial);
  }

  get state(): LiveState {
    return this.history.state;
  }

  get listenerCount(): number {
    return this.listeners.size;
  }

  /**
   * Applies a command and notifies listeners when the state changed.
   *
   * @param onListenerError - Receives errors thrown by listeners, which never
   * reach other listeners or the state.
   * @returns Whether the state changed.
   */
  dispatch(
    command: LiveCommand,
    onListenerError?: (error: unknown) => void,
  ): boolean {
    const next = applyCommand(this.history, command, this.now());
    if (next === this.history) return false;
    this.history = next;
    this.notify(next.state, onListenerError);
    return true;
  }

  subscribe(listener: LiveListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(
    state: LiveState,
    onListenerError?: (error: unknown) => void,
  ): void {
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch (error) {
        onListenerError?.(error);
      }
    }
  }
}

/** Applies a command to the store and logs every listener that throws. */
export function dispatchLogged(
  store: LiveStore,
  command: LiveCommand,
  log: Logger,
): void {
  store.dispatch(command, error =>
    log.error('live state listener failed', error),
  );
}
