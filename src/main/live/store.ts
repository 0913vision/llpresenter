import type {LiveCommand} from '@shared/commands';
import {randomUUID} from 'node:crypto';
import {createMessageId} from '@shared/schema/ids';
import type {LiveState} from '@shared/live';
import type {Logger} from '../log';
import type {SettingsReader} from '../store/settingsStore';
import {initialHistory, liveSlices, type LiveHistory} from './reducer';
import type {SliceRegistry, SkippedLiveCommand} from './sliceRegistry';

export type LiveListener = (state: LiveState) => void;

/**
 * The single source of truth for the live state. It doesn't depend on
 * Electron; the IPC layer subscribes to it to reach the windows.
 */
export class LiveStore {
  private history: LiveHistory;
  private readonly listeners = new Set<LiveListener>();
  private settings: SettingsReader | undefined;

  /**
   * Starts from the initial state.
   *
   * @param now - The clock that stamps commands; tests pass a fixed one.
   */
  constructor(
    initial?: LiveState,
    private readonly now: () => number = Date.now,
    private readonly slices: SliceRegistry = liveSlices,
  ) {
    this.history = initialHistory(initial ?? slices.initialState());
  }

  get state(): LiveState {
    return this.history.state;
  }

  get listenerCount(): number {
    return this.listeners.size;
  }

  handles(type: string): boolean {
    return this.slices.handles(type);
  }

  /** Attaches current main-process settings; the returned release is identity-safe. */
  connectSettings(settings: SettingsReader): () => void {
    this.settings = settings;
    return () => {
      if (this.settings === settings) this.settings = undefined;
    };
  }

  /**
   * Applies a command and notifies listeners when the state changed.
   *
   * @param onListenerError - Receives errors thrown by listeners, which never
   * reach other listeners or the state.
   * @param onSkipped - Receives one diagnostic per unsupported or failed command.
   * @returns Whether the state changed.
   */
  dispatch(
    command: LiveCommand,
    onListenerError?: (error: unknown) => void,
    onSkipped?: (problem: SkippedLiveCommand) => void,
  ): boolean {
    const {history: next, skipped} = this.slices.run(this.history, command, {
      now: this.now(),
      ...(this.settings === undefined ? {} : {settings: this.settings}),
      nextMessageId: () => createMessageId(randomUUID()),
    });
    const changed = next !== this.history;
    this.history = next;
    for (const problem of skipped) {
      try {
        onSkipped?.(problem);
      } catch (error) {
        onListenerError?.(error);
      }
    }
    if (!changed) return false;
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

/** Rejects unhandled commands and logs every listener that throws. */
export function dispatchLogged(
  store: LiveStore,
  command: LiveCommand,
  log: Logger,
): void {
  if (!store.handles(command.type)) {
    log.warn('unhandled live command', {type: command.type});
    return;
  }
  store.dispatch(
    command,
    error => log.error('live state listener failed', error),
    problem => {
      if (problem.reason === 'unhandled') {
        log.warn('unhandled live command', {type: problem.type});
      } else if (problem.reason === 'missing-target') {
        log.warn('skipped live command', {
          type: problem.type,
          reason: problem.reason,
          target: problem.error.target,
        });
      } else {
        log.error('live command failed', {
          type: problem.type,
          error: problem.error,
        });
      }
    },
  );
}
