import type {LiveCommand, SingleLiveCommand} from '@shared/commands';
import {randomUUID} from 'node:crypto';
import {createMessageId} from '@shared/schema/ids';
import {MAX_LIVE_BATCH_COMMANDS} from '@shared/schema/liveCommand';
import type {LiveState} from '@shared/live';
import type {Logger} from '../log';
import type {SettingsReader} from '../store/settingsStore';
import {initialHistory, liveSlices, type LiveHistory} from './reducer';
import type {SliceRegistry, SkippedLiveCommand} from './sliceRegistry';
import type {MacroCommandPort, ScreenSettingsPort} from './slice';

export type LiveListener = (state: LiveState) => void;

/**
 * The single source of truth for the live state. It doesn't depend on
 * Electron; the IPC layer subscribes to it to reach the windows.
 */
export class LiveStore {
  private history: LiveHistory;
  private readonly listeners = new Set<LiveListener>();
  private settings: SettingsReader | undefined;
  private screenSettings: ScreenSettingsPort | undefined;
  private macros: MacroCommandPort | undefined;

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

  /** Attaches the saved output screens; disposal releases only this connection. */
  connectScreenSettings(screenSettings: ScreenSettingsPort): () => void {
    this.screenSettings = screenSettings;
    return () => {
      if (this.screenSettings === screenSettings) {
        this.screenSettings = undefined;
      }
    };
  }

  /** Attaches data-backed macro execution; disposal releases only this connection. */
  connectMacros(macros: MacroCommandPort): () => void {
    this.macros = macros;
    return () => {
      if (this.macros === macros) this.macros = undefined;
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
      ...(this.macros === undefined ? {} : {macros: this.macros}),
      nextMessageId: () => createMessageId(randomUUID()),
      ...(this.screenSettings === undefined
        ? {}
        : {screenSettings: this.screenSettings}),
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

/**
 * Rejects unhandled commands and logs every listener that throws.
 *
 * @returns Whether the state changed.
 */
export function dispatchLogged(
  store: LiveStore,
  command: LiveCommand,
  log: Logger,
): boolean {
  if (!store.handles(command.type)) {
    log.warn('unhandled live command', {type: command.type});
    return false;
  }
  return store.dispatch(
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
      } else if (problem.reason === 'invalid-overlay') {
        log.warn('skipped live command', {
          type: problem.type,
          reason: problem.reason,
          error: problem.error,
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

/**
 * Applies commands in order, in as few bounded transactions as the batch limit
 * allows.
 *
 * @returns Whether any transaction changed the state.
 */
export function dispatchBatched(
  store: LiveStore,
  commands: readonly SingleLiveCommand[],
  log: Logger,
): boolean {
  let changed = false;
  for (
    let start = 0;
    start < commands.length;
    start += MAX_LIVE_BATCH_COMMANDS
  ) {
    const batch = commands.slice(start, start + MAX_LIVE_BATCH_COMMANDS);
    const batchChanged = dispatchLogged(
      store,
      {type: 'live.batch', commands: batch},
      log,
    );
    changed ||= batchChanged;
  }
  return changed;
}
