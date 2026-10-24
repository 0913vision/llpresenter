import type {LiveState} from '@shared/live';
import {assignMonitors, type DisplayRequest} from '../displays/assign';
import {findControlMonitor, type Monitor} from '../displays/monitor';
import type {Rect} from '../displays/rect';
import type {LiveStore} from '../live/store';
import type {Logger} from '../log';
import {OutputWindow, type CreateOutputWindowHandle} from './outputWindow';
import type {RendererState} from './rendererRecovery';
import {planPlacement, type Placement} from './placement';
import type {OutputScreen, ScreenSource} from './screens';

/** The connected monitors, kept current. */
export interface MonitorFeed {
  readonly monitors: readonly Monitor[];
  /**
   * Calls the listener whenever the monitors change.
   *
   * @returns A function that removes the listener.
   */
  subscribe(listener: () => void): () => void;
}

/** How a screen's output shows. */
export type OutputStatus = 'off' | 'fullscreen' | 'window' | 'monitorMissing';

/** The arguments of the {@link OutputManager} constructor. */
export interface OutputManagerOptions {
  readonly store: LiveStore;
  readonly displays: MonitorFeed;
  readonly screens: ScreenSource;
  /** The control window's bounds, or null when it is gone. */
  readonly controlBounds: () => Rect | null;
  readonly createHandle: CreateOutputWindowHandle;
  readonly log: Logger;
  /** Hears every change of a screen's placement or renderer state. */
  readonly onStatusChange?: () => void;
}

/** How one screen's output shows and what its renderer is doing. */
export interface ScreenOutputState {
  readonly placement: OutputStatus;
  readonly renderer: RendererState;
}

interface Surroundings {
  readonly assigned: ReadonlyMap<string, Monitor>;
  readonly controlMonitor: Monitor;
}

function statusOf(placement: Placement | null): OutputStatus {
  if (placement === null) return 'off';
  switch (placement.kind) {
    case 'fullscreen':
      return 'fullscreen';
    case 'window':
      return placement.reason === 'monitorMissing'
        ? 'monitorMissing'
        : 'window';
    case 'off':
      return 'monitorMissing';
  }
}

function displayRequests(
  screens: readonly OutputScreen[],
): readonly DisplayRequest[] {
  return screens.flatMap(({id, display}) =>
    display === null ? [] : [{screenId: id, display}],
  );
}

/**
 * Keeps one output window per screen in line with the output switches in the
 * live state and with the connected monitors. The main process owns the live
 * state; this only shows, hides, and moves windows, and turns an output off
 * when its window closes or its monitor goes away with 연결이 끊기면 set to
 * off.
 */
export class OutputManager {
  private readonly windows = new Map<string, OutputWindow>();
  private readonly statuses = new Map<string, OutputStatus>();
  private previousMonitors: ReadonlyMap<string, number> = new Map();
  private stops: ReadonlyArray<() => void> = [];
  private lastOutputs: LiveState['outputs'] | null = null;
  private disposed = false;

  constructor(private readonly options: OutputManagerOptions) {}

  start(): void {
    const {store, displays} = this.options;
    this.stops = [
      store.subscribe(state => this.handleLiveState(state)),
      displays.subscribe(() => this.sync()),
    ];
    this.sync();
  }

  /**
   * A screen's page reported its frame rate: a window that restarted shows
   * the live picture again, and a hung page is noticed when the reports stop.
   */
  frameReported(screenId: string): void {
    this.windows.get(screenId)?.frameReported();
  }

  /** 다시 시도 for a screen whose window holds the restart limit. */
  retry(screenId: string): void {
    this.windows.get(screenId)?.retry();
  }

  /** The placement and renderer state of every screen in the list. */
  screenStates(): ReadonlyMap<string, ScreenOutputState> {
    return new Map(
      this.options.screens.list().map(({id}) => [
        id,
        {
          placement: this.statuses.get(id) ?? 'off',
          renderer: this.windows.get(id)?.rendererState ?? 'running',
        },
      ]),
    );
  }

  /** Destroys every output window and stops listening. Call it before the app quits. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const stop of this.stops) stop();
    for (const output of this.windows.values()) output.dispose();
    this.windows.clear();
  }

  private handleLiveState(state: LiveState): void {
    // NOTE(0913vision): A 장 or a clear doesn't change the output switches,
    // and the reducer keeps the same object then, so the windows stay put.
    if (state.outputs === this.lastOutputs) return;
    this.sync();
  }

  private sync(): void {
    if (this.disposed) return;
    const surroundings = this.surroundings();
    if (surroundings === null) return;
    this.rememberMonitors(surroundings.assigned);
    const screens = this.options.screens.list();
    this.lastOutputs = this.options.store.state.outputs;
    const turnOff: string[] = [];
    for (const screen of screens) {
      const placement = this.placementFor(screen, surroundings);
      this.apply(screen, placement);
      if (placement?.kind === 'off') turnOff.push(screen.id);
    }
    this.removeWindowsNotIn(screens);
    for (const screenId of turnOff) this.turnOff(screenId);
  }

  private surroundings(): Surroundings | null {
    const {displays, screens, controlBounds, log} = this.options;
    const monitors = displays.monitors;
    const controlMonitor = findControlMonitor(monitors, controlBounds());
    if (controlMonitor === null) {
      log.warn('no monitor to place the output windows on');
      return null;
    }
    const assigned = assignMonitors({
      requests: displayRequests(screens.list()),
      monitors,
      controlMonitorId: controlMonitor.id,
      previous: this.previousMonitors,
    });
    return {assigned, controlMonitor};
  }

  private rememberMonitors(assigned: ReadonlyMap<string, Monitor>): void {
    this.previousMonitors = new Map(
      [...assigned].map(([screenId, {id}]) => [screenId, id]),
    );
  }

  private placementFor(
    screen: OutputScreen,
    {assigned, controlMonitor}: Surroundings,
  ): Placement | null {
    if (this.options.store.state.outputs[screen.id] !== true) return null;
    const monitor = assigned.get(screen.id) ?? null;
    return planPlacement({screen, monitor, controlMonitor});
  }

  private apply(screen: OutputScreen, placement: Placement | null): void {
    try {
      this.windowFor(screen).update(
        placement === null || placement.kind === 'off' ? null : placement,
      );
    } catch (error) {
      this.options.log.error(
        `could not update the ${screen.id} output window`,
        error,
      );
    }
    this.report(screen.id, statusOf(placement));
  }

  private windowFor(screen: OutputScreen): OutputWindow {
    const existing = this.windows.get(screen.id);
    if (existing !== undefined) return existing;
    const output = new OutputWindow({
      screen,
      createHandle: this.options.createHandle,
      onCloseRequested: () => this.turnOff(screen.id),
      log: this.options.log,
      onRendererState: () => this.options.onStatusChange?.(),
    });
    this.windows.set(screen.id, output);
    return output;
  }

  private removeWindowsNotIn(screens: readonly OutputScreen[]): void {
    for (const [screenId, output] of this.windows) {
      if (screens.some(({id}) => id === screenId)) continue;
      output.dispose();
      this.windows.delete(screenId);
      this.statuses.delete(screenId);
    }
  }

  private turnOff(screenId: string): void {
    this.options.store.dispatch(
      {type: 'output.set', screenId, on: false},
      error => this.options.log.error('live state listener failed', error),
    );
  }

  private report(screenId: string, status: OutputStatus): void {
    if ((this.statuses.get(screenId) ?? 'off') === status) return;
    this.statuses.set(screenId, status);
    this.options.onStatusChange?.();
    const detail = {screen: screenId, status};
    if (status === 'monitorMissing') {
      this.options.log.warn('output monitor missing', detail);
    } else {
      this.options.log.info('output status changed', detail);
    }
  }
}
