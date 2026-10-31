import type {SettingsReader} from '@core/schema/settingsReader';
import type {LiveCommand, SingleLiveCommand} from '@core/live/commands';
import {randomUUID} from 'node:crypto';
import {createMessageId} from '@core/schema/ids';
import {MAX_LIVE_BATCH_COMMANDS} from '@core/schema/liveCommand';
import {macroDroppedProblem, type AppProblem} from '@core/schema/appProblem';
import type {LiveState} from '@core/live/state';
import type {Logger} from '../log';
import type {MediaList} from '@core/schema/mediaList';
import {backgroundProgress} from '@core/media/backgroundPosition';
import type {MediaProgress} from '@core/schema/mediaProgress';
import {SYSTEM_CLOCK, type LiveClock} from './clock';
import {initialHistory, liveSlices, type LiveHistory} from './reducer';
import type {SliceRegistry, SkippedLiveCommand} from './sliceRegistry';
import type {
  MacroCommandPort,
  MonitorNumbersPort,
  ScreenSettingsPort,
  SliceInputs,
} from './slice';

export type LiveListener = (state: LiveState) => void;

export type ProblemListener = (problem: AppProblem) => void;

/**
 * The single source of truth for the live state. It doesn't depend on
 * Electron; the IPC layer subscribes to it to reach the windows.
 */
export class LiveStore {
  private history: LiveHistory;
  private themes: SliceInputs['themes'];
  private readonly listeners = new Set<LiveListener>();
  private readonly problemListeners = new Set<ProblemListener>();
  private settings: SettingsReader | undefined;
  private screenSettings: ScreenSettingsPort | undefined;
  private monitorNumbers: MonitorNumbersPort | undefined;
  private macros: MacroCommandPort | undefined;
  private audioMedia: (() => MediaList) | undefined;
  private readonly readClock: () => Pick<SliceInputs, 'now' | 'timerNow'>;

  /**
   * Starts from the initial state.
   *
   * @param clock - The clocks that stamp commands; a single function serves as
   * both, as tests pass a fixed one.
   */
  constructor(
    initial?: LiveState,
    clock: LiveClock | (() => number) = SYSTEM_CLOCK,
    private readonly slices: SliceRegistry = liveSlices,
  ) {
    this.history = initialHistory(initial ?? slices.initialState());
    this.readClock =
      typeof clock === 'function'
        ? () => {
            const now = clock();
            return {now, timerNow: now};
          }
        : () => ({now: clock.wall(), timerNow: clock.timer()});
  }

  get state(): LiveState {
    return this.history.state;
  }

  mediaProgress(): MediaProgress | null {
    return backgroundProgress(
      this.state.layers.media,
      this.audioMedia?.().items ?? [],
      this.readClock().now,
    );
  }

  connectThemes(themes: NonNullable<SliceInputs['themes']>): () => void {
    this.themes = themes;
    return () => {
      if (this.themes === themes) this.themes = undefined;
    };
  }

  connectAudioMedia(read: () => MediaList): () => void {
    this.audioMedia = read;
    return () => {
      if (this.audioMedia === read) this.audioMedia = undefined;
    };
  }

  /** The 타이머 clock that stamps 타이머 runs, for windows to read them. */
  timerNow(): number {
    const {now, timerNow = now} = this.readClock();
    return timerNow;
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

  /** Attaches the monitor number windows; the returned release is identity-safe. */
  connectMonitorNumbers(monitorNumbers: MonitorNumbersPort): () => void {
    this.monitorNumbers = monitorNumbers;
    return () => {
      if (this.monitorNumbers === monitorNumbers) {
        this.monitorNumbers = undefined;
      }
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
   * @param onSkipped - Receives one diagnostic per unsupported or failed command,
   * and last the one for a dropped dispatch. Each 매크로 that a dropped
   * dispatch ran then goes to the problem listeners.
   * @returns Whether the state changed.
   */
  dispatch(
    command: LiveCommand,
    onListenerError?: (error: unknown) => void,
    onSkipped?: (problem: SkippedLiveCommand) => void,
  ): boolean {
    const {history: next, skipped} = this.slices.run(this.history, command, {
      ...(this.themes === undefined ? {} : {themes: this.themes}),
      ...this.readClock(),
      ...(this.audioMedia === undefined ? {} : {audioMedia: this.audioMedia}),
      ...(this.settings === undefined ? {} : {settings: this.settings}),
      ...(this.macros === undefined ? {} : {macros: this.macros}),
      nextMessageId: () => createMessageId(randomUUID()),
      ...(this.screenSettings === undefined
        ? {}
        : {screenSettings: this.screenSettings}),
      ...(this.monitorNumbers === undefined
        ? {}
        : {monitorNumbers: this.monitorNumbers}),
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
    this.reportDroppedMacros(skipped, onListenerError);
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

  /** Calls the listener for each problem a dispatch reports to the windows. */
  subscribeProblems(listener: ProblemListener): () => void {
    this.problemListeners.add(listener);
    return () => {
      this.problemListeners.delete(listener);
    };
  }

  private reportDroppedMacros(
    skipped: readonly SkippedLiveCommand[],
    onListenerError?: (error: unknown) => void,
  ): void {
    for (const problem of skipped) {
      if (problem.reason !== 'dropped') continue;
      for (const {macroId, name} of problem.macros) {
        this.notifyProblem(macroDroppedProblem(macroId, name), onListenerError);
      }
    }
  }

  private notifyProblem(
    problem: AppProblem,
    onListenerError?: (error: unknown) => void,
  ): void {
    for (const listener of this.problemListeners) {
      try {
        listener(problem);
      } catch (error) {
        onListenerError?.(error);
      }
    }
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
      } else if (problem.reason === 'dropped') {
        log.warn('dropped live dispatch', {
          type: problem.type,
          error: problem.error,
          macroIds: problem.macros.map(({macroId}) => macroId),
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
