import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {LiveCommand} from '@core/live/commands';
import {emptyLiveState, type LiveState} from '@core/live/state';
import {
  monitorById,
  monitorsOf,
  recordingLogger,
  type DisplaySpec,
} from '@fixtures/main/displays/testing';
import {fullScreenScreen} from '@fixtures/main/outputs/testing';
import {assignMonitors} from '@main/displays/assign';
import {findControlMonitor, type Monitor} from '@main/displays/monitor';
import type {Rect, Size} from '@main/displays/rect';
import type {MonitorRemovedListener} from '@main/displays/registry';
import type {LiveStore} from '@main/live/store';
import {OutputManager, type MonitorFeed} from '@main/outputs/manager';
import type {
  CreateOutputWindowHandle,
  OutputWindowOptions,
} from '@main/outputs/outputWindow';
import {
  OUTPUT_WINDOW_SIZE,
  fitAspectBounds,
  planPlacement,
  type ShownPlacement,
} from '@main/outputs/placement';
import type {OutputScreen, ScreenSource} from '@main/outputs/screens';

const mocks = vi.hoisted(() => {
  class Output {
    rendererState: 'running' | 'restarting' | 'limited' = 'running';
    readonly update =
      vi.fn<
        (placement: ShownPlacement | null, screen?: OutputScreen) => void
      >();
    readonly preload = vi.fn<(placement?: ShownPlacement) => void>();
    readonly frameReady = vi.fn(() => true);
    readonly frameReported = vi.fn();
    readonly retry = vi.fn();
    readonly prepareForMonitorRemoval = vi.fn();
    readonly bringToFront = vi.fn();
    readonly captureArea = vi.fn<() => Rect | null>(() => null);
    readonly shownPlacement = vi.fn<() => ShownPlacement | null>(() => null);
    readonly shownContentSize = vi.fn<() => Size | null>(() => null);
    readonly dispose = vi.fn();
    constructor(readonly options: OutputWindowOptions) {
      outputs.push(this);
    }
  }
  const outputs: Output[] = [];
  return {Output, outputs};
});

vi.mock('@main/outputs/outputWindow', () => ({OutputWindow: mocks.Output}));
vi.mock('@main/outputs/placement', async importOriginal => ({
  ...(await importOriginal<typeof import('@main/outputs/placement')>()),
  planPlacement: vi.fn(),
}));
vi.mock('@main/displays/assign', () => ({assignMonitors: vi.fn()}));
vi.mock('@main/displays/monitor', async importOriginal => ({
  ...(await importOriginal<typeof import('@main/displays/monitor')>()),
  findControlMonitor: vi.fn(),
}));

class MockMonitorFeed implements MonitorFeed {
  private readonly listeners = new Set<() => void>();
  private readonly removalListeners = new Set<MonitorRemovedListener>();

  constructor(public monitors: readonly Monitor[]) {}

  get listenerCount(): number {
    return this.listeners.size + this.removalListeners.size;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  subscribeRemoved(listener: MonitorRemovedListener): () => void {
    this.removalListeners.add(listener);
    return () => {
      this.removalListeners.delete(listener);
    };
  }

  change(monitors: readonly Monitor[] = this.monitors): void {
    this.monitors = monitors;
    for (const listener of this.listeners) listener();
  }

  remove(monitorId: number): void {
    for (const listener of this.removalListeners) listener(monitorId);
  }
}

class MockScreenSource implements ScreenSource {
  ready = true;
  private readonly listeners = new Set<() => void>();

  constructor(public screens: readonly OutputScreen[]) {}

  get listenerCount(): number {
    return this.listeners.size;
  }

  list(): readonly OutputScreen[] {
    return this.screens;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  announce(screens: readonly OutputScreen[]): void {
    this.screens = screens;
    for (const listener of this.listeners) listener();
  }
}

function nextOutputs(
  outputs: LiveState['outputs'],
  command: LiveCommand,
): LiveState['outputs'] {
  if (command.type === 'live.batch') {
    return command.commands.reduce(nextOutputs, outputs);
  }
  if (
    command.type !== 'output.set' ||
    outputs[command.screenId] === command.on
  ) {
    return outputs;
  }
  return {...outputs, [command.screenId]: command.on};
}

function mockStore() {
  let state: LiveState = emptyLiveState();
  const listeners = new Set<(state: LiveState) => void>();
  return {
    get state() {
      return state;
    },
    listenerCount: () => listeners.size,
    subscribe: vi.fn<LiveStore['subscribe']>(listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
    dispatch: vi.fn<LiveStore['dispatch']>(command => {
      const outputs = nextOutputs(state.outputs, command);
      const switches =
        command.type === 'output.set' || command.type === 'live.batch';
      if (switches && outputs === state.outputs) return true;
      state = {...state, outputs, version: state.version + 1};
      for (const listener of listeners) listener(state);
      return true;
    }),
  };
}

const CONTROL: DisplaySpec = {id: 1, primary: true};
const PROJECTOR: DisplaySpec = {id: 2, x: 1920, name: 'EPSON PJ'};
const STAGE: DisplaySpec = {id: 3, x: 3840, name: 'LG TV'};
const MONITORS = monitorsOf(CONTROL, PROJECTOR, STAGE);
const CONTROL_WINDOW = {x: 0, y: 0, width: 1920, height: 1040};
const FALLBACK: ShownPlacement = {
  kind: 'window',
  bounds: {x: 480, y: 250, width: 960, height: 540},
  reason: 'monitorMissing',
};

function monitor(spec: DisplaySpec): Monitor {
  return monitorById(MONITORS, spec.id);
}

function fullScreenOn(spec: DisplaySpec): ShownPlacement {
  return {kind: 'fullscreen', bounds: monitor(spec).bounds, alwaysOnTop: true};
}

function screenOn(
  spec: DisplaySpec,
  overrides: Partial<OutputScreen> = {},
): OutputScreen {
  const {id, name, bounds} = monitor(spec);
  return fullScreenScreen({display: {id, name, bounds}, ...overrides});
}

function turn(on: boolean, screenId = 'main'): LiveCommand {
  return {type: 'output.set', screenId, on};
}

function outputOf(screenId: string) {
  const found = mocks.outputs.filter(
    ({options}) => options.screen.id === screenId,
  );
  const [output] = found;
  if (found.length !== 1 || output === undefined) {
    throw new Error(`Expected one ${screenId} output`);
  }
  return output;
}

function setUp(
  screens: readonly OutputScreen[] = [screenOn(PROJECTOR)],
  monitors: readonly Monitor[] = MONITORS,
) {
  const store = mockStore();
  const displays = new MockMonitorFeed(monitors);
  const source = new MockScreenSource(screens);
  const log = recordingLogger();
  const onStatusChange = vi.fn();
  const manager = new OutputManager({
    store,
    displays,
    screens: source,
    controlBounds: () => CONTROL_WINDOW,
    createHandle: vi.fn<CreateOutputWindowHandle>(),
    log,
    onStatusChange,
  });
  manager.start();
  return {store, displays, source, log, onStatusChange, manager};
}

beforeEach(() => {
  mocks.outputs.length = 0;
  vi.clearAllMocks();
  vi.mocked(findControlMonitor).mockImplementation(
    monitors => monitors[0] ?? null,
  );
  vi.mocked(assignMonitors).mockImplementation(
    ({requests, monitors}) =>
      new Map(
        requests.flatMap(({screenId, display}) => {
          const found = monitors.find(({id}) => id === display.id);
          return found === undefined ? [] : [[screenId, found] as const];
        }),
      ),
  );
  vi.mocked(planPlacement).mockImplementation(({monitor: assigned}) =>
    assigned === null
      ? FALLBACK
      : {kind: 'fullscreen', bounds: assigned.bounds, alwaysOnTop: true},
  );
});

describe('OutputManager placement', () => {
  it('replaces the target window and reports NDI when a screen changes target', () => {
    const initial = screenOn(PROJECTOR);
    const {manager, store, source} = setUp([initial]);
    store.dispatch(turn(true));
    const previous = outputOf('main');
    source.announce([{...initial, method: 'capture', target: 'ndi'}]);
    expect(previous.dispose).toHaveBeenCalledOnce();
    expect(mocks.outputs).toHaveLength(2);
    expect(mocks.outputs[1]?.options.screen.target).toBe('ndi');
    expect(manager.screenStates().get('main')?.placement).toBe('ndi');
    manager.dispose();
  });
  it('replans an enabled screen on control movement and reports its conflict target', () => {
    const {manager, store} = setUp();
    store.dispatch(turn(true));
    vi.mocked(findControlMonitor).mockReturnValue(monitor(PROJECTOR));
    vi.mocked(planPlacement).mockReturnValue({
      ...FALLBACK,
      reason: 'controlConflict',
    });
    manager.controlMonitorChanged();
    expect(planPlacement).toHaveBeenLastCalledWith(
      expect.objectContaining({controlMonitor: monitor(PROJECTOR)}),
    );
    expect(manager.screenStates().get('main')).toMatchObject({
      placement: 'controlConflict',
      monitor: 2,
    });
    expect(manager.assignedMonitorIds.get('main')).toBe(2);
    vi.mocked(planPlacement).mockReturnValue(fullScreenOn(PROJECTOR));
    manager.controlMonitorChanged();
    expect(manager.screenStates().get('main')?.placement).toBe('fullscreen');
    manager.dispose();
  });
  it('prepares each screen at its planned placement while off, and shows and hides it with its switch', () => {
    const screen = screenOn(PROJECTOR);
    const {store} = setUp([screen]);
    const output = outputOf('main');

    expect(planPlacement).toHaveBeenCalledWith({
      screen,
      monitor: monitor(PROJECTOR),
      controlMonitor: monitor(CONTROL),
    });
    expect(output.preload).toHaveBeenCalledWith(fullScreenOn(PROJECTOR));
    expect(output.update).toHaveBeenLastCalledWith(null, screen);
    store.dispatch(turn(true));
    expect(output.update).toHaveBeenLastCalledWith(
      fullScreenOn(PROJECTOR),
      screen,
    );
    store.dispatch(turn(false));
    expect(output.update).toHaveBeenLastCalledWith(null, screen);
    expect(mocks.outputs).toHaveLength(1);
  });

  it('leaves the windows alone when only the content changes', () => {
    const {store, source} = setUp();
    store.dispatch(turn(true));
    const list = vi.spyOn(source, 'list');
    outputOf('main').update.mockClear();

    store.dispatch({type: 'layer.clear', target: 'all'});

    expect(list).not.toHaveBeenCalled();
    expect(outputOf('main').update).not.toHaveBeenCalled();
  });

  it('asks for saved monitors only for full screen screens, passing on the last assignment', () => {
    const main = screenOn(PROJECTOR);
    const capture = screenOn(STAGE, {id: 'capture', method: 'capture'});
    const spare = fullScreenScreen({id: 'spare'});
    const {displays} = setUp([main, capture, spare]);

    expect(assignMonitors).toHaveBeenLastCalledWith({
      requests: [{screenId: 'main', display: main.display}],
      monitors: MONITORS,
      controlMonitorId: CONTROL.id,
      previous: new Map(),
    });
    displays.change();
    expect(vi.mocked(assignMonitors).mock.lastCall?.[0].previous).toEqual(
      new Map([['main', PROJECTOR.id]]),
    );
  });

  it('replans every screen with the same window when the monitors or the screen list change', () => {
    const screen = screenOn(PROJECTOR);
    const {store, displays, source} = setUp([screen]);
    store.dispatch(turn(true));

    displays.change(monitorsOf(CONTROL));
    expect(outputOf('main').update).toHaveBeenLastCalledWith(FALLBACK, screen);
    const renamed = {...screen, name: '새 이름'};
    source.announce([renamed]);

    expect(outputOf('main').update).toHaveBeenLastCalledWith(FALLBACK, renamed);
    expect(outputOf('main').preload).toHaveBeenLastCalledWith(FALLBACK);
  });

  it('places every output over the control window while no monitor is known', () => {
    const main = screenOn(PROJECTOR);
    const capture = fullScreenScreen({
      id: 'capture',
      method: 'capture',
      resolution: {width: 1280, height: 720},
    });
    const windowed = fullScreenScreen({id: 'window', method: 'window'});
    const off = screenOn(PROJECTOR, {id: 'off', onDisconnect: 'off'});
    const {store, log} = setUp([main, capture, windowed, off], []);

    store.dispatch({
      type: 'live.batch',
      commands: ['main', 'capture', 'window', 'off'].map(screenId => ({
        type: 'output.set' as const,
        screenId,
        on: true,
      })),
    });

    const bounds = fitAspectBounds(CONTROL_WINDOW, OUTPUT_WINDOW_SIZE);
    expect(outputOf('main').update).toHaveBeenLastCalledWith(
      {kind: 'window', bounds, reason: 'monitorMissing'},
      main,
    );
    expect(outputOf('capture').update).toHaveBeenLastCalledWith(
      {
        kind: 'capture',
        bounds: fitAspectBounds(CONTROL_WINDOW, {width: 1280, height: 720}),
        alwaysOnTop: true,
      },
      capture,
    );
    expect(outputOf('window').update).toHaveBeenLastCalledWith(
      {kind: 'window', bounds, reason: 'method', alwaysOnTop: true},
      windowed,
    );
    expect(outputOf('off').update).toHaveBeenLastCalledWith(null, off);
    expect(store.state.outputs['off']).toBe(false);
    expect(log.messages('warn')).toContain(
      'no monitor to place the output windows on',
    );
  });

  it('opens a screen that never had a monitor as a plain window while no monitor is known', () => {
    const unassigned = fullScreenScreen({id: 'plain', onDisconnect: 'off'});
    const {store} = setUp([unassigned], []);
    store.dispatch({type: 'output.set', screenId: 'plain', on: true});

    const bounds = fitAspectBounds(CONTROL_WINDOW, OUTPUT_WINDOW_SIZE);
    expect(outputOf('plain').update).toHaveBeenLastCalledWith(
      {kind: 'window', bounds, reason: 'method'},
      unassigned,
    );
    expect(store.state.outputs['plain']).toBe(true);
  });

  it('turns an output off when its plan says off, or when the operator closes its window', () => {
    const screen = screenOn(PROJECTOR, {onDisconnect: 'off'});
    const {store, displays} = setUp([screen]);
    store.dispatch(turn(true));

    vi.mocked(planPlacement).mockReturnValue({kind: 'off'});
    displays.change();
    expect(store.state.outputs['main']).toBe(false);
    expect(outputOf('main').update).toHaveBeenLastCalledWith(null, screen);

    vi.mocked(planPlacement).mockReturnValue(fullScreenOn(PROJECTOR));
    store.dispatch(turn(true));
    outputOf('main').options.onCloseRequested();
    expect(store.state.outputs['main']).toBe(false);
  });

  it('turns off the outputs of screens a ready list no longer has', () => {
    const {store, source} = setUp([
      screenOn(PROJECTOR),
      fullScreenScreen({id: 'old'}),
    ]);
    store.dispatch(turn(true, 'old'));

    source.ready = false;
    source.announce([screenOn(PROJECTOR)]);
    expect(store.state.outputs['old']).toBe(true);
    source.ready = true;
    source.announce([screenOn(PROJECTOR)]);

    expect(store.state.outputs['old']).toBe(false);
    expect(store.dispatch).toHaveBeenLastCalledWith(
      {
        type: 'live.batch',
        commands: [{type: 'output.set', screenId: 'old', on: false}],
      },
      expect.any(Function),
    );
  });

  it('closes the window of a screen that leaves the list and announces it', () => {
    const {source, manager, onStatusChange} = setUp([
      screenOn(PROJECTOR),
      fullScreenScreen({id: 'stage'}),
    ]);
    const stage = outputOf('stage');
    onStatusChange.mockClear();

    source.announce([screenOn(PROJECTOR)]);

    expect(stage.dispose).toHaveBeenCalledOnce();
    expect(onStatusChange).toHaveBeenCalled();
    expect(manager.screenStates().has('stage')).toBe(false);
  });

  it('keeps the other outputs going when one window fails', () => {
    const stage = screenOn(STAGE, {id: 'stage'});
    const {store, log} = setUp([screenOn(PROJECTOR), stage]);
    const failure = () => {
      throw new Error('no window today');
    };
    outputOf('main').update.mockImplementation(failure);
    outputOf('main').preload.mockImplementation(failure);

    store.dispatch(turn(true, 'stage'));

    expect(outputOf('stage').update).toHaveBeenLastCalledWith(
      fullScreenOn(STAGE),
      stage,
    );
    expect(log.messages('error')).toContain(
      'could not preload the main output',
    );
    expect(log.messages('error')).toContain(
      'could not prepare the main output',
    );
    expect(log.messages('error')).toContain(
      'could not update the main output window',
    );
  });
});

describe('OutputManager monitor removal', () => {
  it('demotes only the outputs on a removed monitor and holds their full screen placement until the monitors settle', () => {
    const main = screenOn(PROJECTOR);
    const {store, displays} = setUp([main, screenOn(STAGE, {id: 'stage'})]);
    store.dispatch(turn(true));
    store.dispatch(turn(true, 'stage'));

    displays.remove(PROJECTOR.id);
    expect(outputOf('main').prepareForMonitorRemoval).toHaveBeenCalledOnce();
    expect(outputOf('stage').prepareForMonitorRemoval).not.toHaveBeenCalled();
    outputOf('main').update.mockClear();
    store.dispatch(turn(false, 'stage'));
    expect(outputOf('main').update).not.toHaveBeenCalled();

    displays.change(monitorsOf(CONTROL, STAGE));
    expect(outputOf('main').update).toHaveBeenLastCalledWith(FALLBACK, main);
  });

  it('shows a demoted output full screen again when its monitor returns before settling', () => {
    const main = screenOn(PROJECTOR);
    const {store, displays} = setUp([main]);
    store.dispatch(turn(true));

    displays.remove(PROJECTOR.id);
    outputOf('main').update.mockClear();
    displays.change(MONITORS);

    expect(outputOf('main').update).toHaveBeenLastCalledWith(
      fullScreenOn(PROJECTOR),
      main,
    );
  });

  it('keeps demoting the other outputs when one demotion fails', () => {
    const {displays, log} = setUp([
      screenOn(PROJECTOR),
      screenOn(PROJECTOR, {id: 'stage'}),
    ]);
    outputOf('main').prepareForMonitorRemoval.mockImplementation(() => {
      throw new Error('window closed during demotion');
    });

    displays.remove(PROJECTOR.id);

    expect(log.messages('error')).toEqual(['could not demote the main output']);
    expect(outputOf('stage').prepareForMonitorRemoval).toHaveBeenCalledOnce();
  });
});

describe('OutputManager status', () => {
  it('reports each status change once, warns about a missing monitor, and keeps the last full screen monitor', () => {
    const {store, displays, manager, log, onStatusChange} = setUp();
    expect(manager.screenStates().get('main')).toEqual({
      placement: 'off',
      renderer: 'running',
      monitor: monitor(PROJECTOR).number,
      monitorAvailable: true,
    });

    store.dispatch(turn(true));
    expect(manager.screenStates().get('main')).toEqual({
      placement: 'fullscreen',
      renderer: 'running',
      monitor: monitor(PROJECTOR).number,
      monitorAvailable: true,
    });
    displays.change(monitorsOf(CONTROL));
    displays.change();

    expect(manager.screenStates().get('main')).toEqual({
      placement: 'monitorMissing',
      renderer: 'running',
      monitor: monitor(PROJECTOR).number,
      monitorAvailable: false,
    });
    expect(log.messages('warn')).toEqual(['output monitor missing']);
    expect(onStatusChange).toHaveBeenCalledTimes(2);
  });

  it('reports the renderer state of a screen, and announces renderer changes', () => {
    const {manager, onStatusChange} = setUp([screenOn(PROJECTOR)]);
    const output = outputOf('main');

    output.rendererState = 'limited';
    output.options.onRendererState?.('limited');

    expect(onStatusChange).toHaveBeenCalledOnce();
    expect(manager.screenStates().get('main')).toEqual({
      placement: 'off',
      renderer: 'limited',
      monitor: monitor(PROJECTOR).number,
      monitorAvailable: true,
    });
  });

  it('keeps the monitor assignment across output toggles and tells its listeners only when it changes', () => {
    const {store, displays, manager, log} = setUp();
    const heard = vi.fn();
    manager.subscribeAssignment(() => {
      throw new Error('listener failed');
    });
    const stop = manager.subscribeAssignment(heard);

    store.dispatch(turn(true));
    store.dispatch(turn(false));
    expect(manager.assignedMonitorIds).toEqual(
      new Map([['main', PROJECTOR.id]]),
    );
    expect(heard).not.toHaveBeenCalled();
    displays.change(monitorsOf(CONTROL));
    expect(manager.assignedMonitorIds).toEqual(new Map());
    stop();
    displays.change(MONITORS);

    expect(heard).toHaveBeenCalledOnce();
    expect(log.messages('error')).toEqual([
      'an assignment listener failed',
      'an assignment listener failed',
    ]);
  });
});

describe('OutputManager routing', () => {
  it("routes frames, 다시 시도 and 창 보기 to the screen's window, and lists shown outputs and capture areas", () => {
    const stage = screenOn(STAGE, {id: 'stage', method: 'capture'});
    const {manager} = setUp([screenOn(PROJECTOR), stage]);
    const frame = {width: 1920, height: 1080, ready: true};

    expect(manager.frameReady('main', 4, frame)).toBe(true);
    expect(manager.frameReady('unknown', 4, frame)).toBe(false);
    manager.frameReported('main');
    manager.retry('main');
    manager.showWindow('main');
    expect(outputOf('main').frameReady).toHaveBeenCalledExactlyOnceWith(
      4,
      frame,
    );
    expect(outputOf('main').frameReported).toHaveBeenCalledOnce();
    expect(outputOf('main').retry).toHaveBeenCalledOnce();
    expect(outputOf('main').bringToFront).toHaveBeenCalledOnce();
    expect(outputOf('stage').frameReported).not.toHaveBeenCalled();

    const placement: ShownPlacement = {
      kind: 'capture',
      bounds: {x: 1920, y: 100, width: 976, height: 579},
    };
    outputOf('stage').shownPlacement.mockReturnValue(placement);
    outputOf('stage').shownContentSize.mockReturnValue({
      width: 960,
      height: 540,
    });
    outputOf('stage').captureArea.mockReturnValue(placement.bounds);
    expect(manager.shownOutputs()).toEqual([
      {screen: stage, placement, contentSize: {width: 960, height: 540}},
    ]);
    expect(manager.captureAreas()).toEqual([placement.bounds]);
  });

  it('destroys every window and stops listening on dispose', () => {
    const {store, displays, source, manager} = setUp();

    manager.dispose();
    manager.dispose();

    expect(outputOf('main').dispose).toHaveBeenCalledOnce();
    expect(store.listenerCount()).toBe(0);
    expect(displays.listenerCount).toBe(0);
    expect(source.listenerCount).toBe(0);
    expect(manager.screenStates().get('main')).toEqual({
      placement: 'off',
      renderer: 'running',
    });
  });
});
