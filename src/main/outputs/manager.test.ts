import {describe, expect, it, vi} from 'vitest';
import type {LiveCommand} from '@shared/commands';
import {installFakeClock} from '../../../test/fake-clock';
import type {Monitor} from '../displays/monitor';
import {
  DISPLAY_RETRY_MS,
  DISPLAY_SETTLE_MS,
  DisplayRegistry,
  type MonitorRemovedListener,
} from '../displays/registry';
import {
  FakeDisplaySource,
  displayInfo,
  monitorById,
  monitorsOf,
  recordingLogger,
  type DisplaySpec,
} from '../displays/testing';
import {LiveStore} from '../live/store';
import {createDefaultScreenSource} from './defaultScreens';
import {OutputManager, type MonitorFeed} from './manager';
import {OUTPUT_REVEAL_DEADLINE_MS} from './outputWindow';
import {OUTPUT_WINDOW_SIZE} from './placement';
import {COOLDOWN_STEPS_MS, RELAUNCH_DELAY_MS} from './rendererRecovery';
import {CRASH_LIMIT} from './restartBudget';
import type {OutputScreen, ScreenSource} from './screens';
import {fakeWindows, fullScreenScreen} from './testing';

class FakeMonitorFeed implements MonitorFeed {
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

  plug(...specs: readonly DisplaySpec[]): void {
    this.monitors = monitorsOf(...specs);
    for (const listener of this.listeners) listener();
  }
}

class FakeScreenSource implements ScreenSource {
  constructor(public screens: readonly OutputScreen[]) {}

  list(): readonly OutputScreen[] {
    return this.screens;
  }
}

const CONTROL: DisplaySpec = {id: 1, primary: true};
const PROJECTOR: DisplaySpec = {id: 2, x: 1920, name: 'EPSON PJ'};
const STAGE: DisplaySpec = {id: 3, x: 3840, name: 'LG TV'};
const CONTROL_WINDOW = {x: 0, y: 0, width: 1920, height: 1040};

const PROJECTOR_BOUNDS = {x: 1920, y: 0, width: 1920, height: 1080};
const FALLBACK_BOUNDS = {x: 480, y: 250, ...OUTPUT_WINDOW_SIZE};

function screenOn(spec: DisplaySpec, overrides: Partial<OutputScreen> = {}) {
  const {id, name, bounds} = monitorById(monitorsOf(spec), spec.id);
  return fullScreenScreen({display: {id, name, bounds}, ...overrides});
}

function turn(on: boolean, screenId = 'main'): LiveCommand {
  return {type: 'output.set', screenId, on};
}

function simulateReadyFrames(
  manager: OutputManager,
  store: LiveStore,
  windows: ReturnType<typeof fakeWindows>,
): void {
  const ready = (): void => {
    for (const id of manager.screenStates().keys()) {
      const handle = windows.created.find(window => window.screen.id === id);
      if (handle !== undefined) {
        manager.frameReady(id, store.state.version, {
          ...handle.contentSize(),
          ready: true,
        });
      }
    }
  };
  const dispatch = store.dispatch.bind(store);
  vi.spyOn(store, 'dispatch').mockImplementation((...args) => {
    const outputs = store.state.outputs;
    const result = dispatch(...args);
    if (store.state.outputs !== outputs) ready();
    return result;
  });
  ready();
}

function setUp(screens: readonly OutputScreen[] = [screenOn(PROJECTOR)]) {
  const store = new LiveStore();
  const displays = new FakeMonitorFeed(monitorsOf(CONTROL, PROJECTOR, STAGE));
  const source = new FakeScreenSource(screens);
  const windows = fakeWindows();
  const log = recordingLogger();
  const manager = new OutputManager({
    store,
    displays,
    screens: source,
    controlBounds: () => CONTROL_WINDOW,
    createHandle: windows.create,
    log,
  });
  manager.start();
  simulateReadyFrames(manager, store, windows);
  return {store, displays, source, windows, log, manager};
}

describe('output identification', () => {
  it('exposes only shown output placements, and removes hidden screens immediately', () => {
    const screen = screenOn(PROJECTOR, {kind: 'audience', alwaysOnTop: true});
    const {manager, store} = setUp([screen]);
    expect(manager.shownOutputs()).toEqual([]);
    store.dispatch(turn(true));
    expect(manager.shownOutputs()).toEqual([
      {
        screen,
        placement: {
          kind: 'fullscreen',
          bounds: PROJECTOR_BOUNDS,
          alwaysOnTop: true,
        },
      },
    ]);
    store.dispatch(turn(false));
    expect(manager.shownOutputs()).toEqual([]);
    manager.dispose();
    expect(manager.shownOutputs()).toEqual([]);
  });
});

function setUpRemoval(
  screens: readonly OutputScreen[] = [
    screenOn(PROJECTOR),
    screenOn(STAGE, {id: 'stage'}),
  ],
) {
  const source = new FakeDisplaySource(
    ...[CONTROL, PROJECTOR, STAGE].map(displayInfo),
  );
  const log = recordingLogger();
  const displays = new DisplayRegistry(source, log);
  const store = new LiveStore();
  const windows = fakeWindows();
  const manager = new OutputManager({
    store,
    displays,
    screens: new FakeScreenSource(screens),
    controlBounds: () => CONTROL_WINDOW,
    createHandle: windows.create,
    log,
  });
  manager.start();
  simulateReadyFrames(manager, store, windows);
  store.dispatch(turn(true));
  store.dispatch(turn(true, 'stage'));
  return {source, displays, store, windows, manager, log};
}

describe('OutputManager', () => {
  it('reveals a bounded fallback even when the initial monitor service never answers', async () => {
    const clock = installFakeClock();
    const store = new LiveStore();
    const windows = fakeWindows();
    const manager = new OutputManager({
      store,
      displays: new FakeMonitorFeed([]),
      screens: new FakeScreenSource([fullScreenScreen()]),
      controlBounds: () => CONTROL_WINDOW,
      createHandle: windows.create,
      log: recordingLogger(),
    });
    manager.start();
    store.dispatch(turn(true));
    await clock.advance(OUTPUT_REVEAL_DEADLINE_MS);
    expect(windows.only('main').mode.kind).toBe('window');
    expect(store.state.outputs.main).toBe(true);
    manager.dispose();
  });
  it('prepares the configured viewport while output is still off', () => {
    const {store, windows} = setUp();
    expect(store.state.outputs.main).not.toBe(true);
    expect(windows.only('main').prepared).toEqual(PROJECTOR_BOUNDS);
    expect(windows.only('main').mode.kind).toBe('hidden');
  });
  it('replans a fallback after a later work-area change without replacing its page', async () => {
    const clock = installFakeClock();
    const {source, displays, windows, manager} = setUpRemoval([
      screenOn(PROJECTOR),
    ]);
    const primary = {
      ...displayInfo(CONTROL),
      bounds: {x: 0, y: 0, width: 3440, height: 1440},
      workArea: {x: 0, y: 0, width: 3440, height: 1440},
    };
    source.remove(PROJECTOR.id);
    source.change(primary);
    await clock.advance(DISPLAY_SETTLE_MS);
    const handle = windows.only('main');
    expect(handle.mode).toMatchObject({
      kind: 'window',
      bounds: {x: 1240, y: 450},
    });
    source.change({
      ...primary,
      workArea: {x: 62, y: 0, width: 3378, height: 1440},
    });
    await clock.advance(DISPLAY_SETTLE_MS);
    expect(handle.mode).toMatchObject({
      kind: 'window',
      bounds: {x: 1271, y: 450},
    });
    expect(windows.created).toHaveLength(1);
    expect(handle.reloads).toBe(0);
    expect(manager.screenStates().get('main')?.placement).toBe(
      'monitorMissing',
    );
    manager.dispose();
    displays.dispose();
  });
  it('runs capture without consuming its saved monitor and closes only that output', () => {
    const {store, windows, manager} = setUp([
      screenOn(PROJECTOR, {id: 'capture', method: 'capture'}),
      screenOn(PROJECTOR),
    ]);
    store.dispatch(turn(true, 'capture'));
    store.dispatch(turn(true));
    expect(windows.only('capture').mode).toMatchObject({
      kind: 'capture',
      bounds: {width: 1920, height: 1080},
    });
    expect(windows.only('main').mode.kind).toBe('fullscreen');
    expect(manager.screenStates().get('capture')?.placement).toBe('window');
    expect(manager.captureAreas()).toEqual([
      expect.objectContaining({width: 1920, height: 1080}),
    ]);
    windows.only('capture').clickClose();
    expect(manager.captureAreas()).toEqual([]);
    expect(store.state.outputs).toMatchObject({capture: false, main: true});
    expect(windows.only('capture').mode.kind).toBe('hidden');
    manager.dispose();
  });

  it('demotes only the removed monitor output before settling and keeps its page running', async () => {
    const clock = installFakeClock();
    const {source, displays, store, windows, manager} = setUpRemoval();
    const main = windows.only('main');
    const stage = windows.only('stage');

    source.remove(PROJECTOR.id);

    expect(main.monitorRemovals).toBe(1);
    expect(main.mode).toMatchObject({kind: 'fullscreen', alwaysOnTop: false});
    expect(stage.monitorRemovals).toBe(0);
    expect(main.placements).toHaveLength(1);
    expect(store.state.outputs['main']).toBe(true);
    store.dispatch(turn(false, 'stage'));
    await clock.advance(DISPLAY_SETTLE_MS - 1);
    expect(main.placements).toHaveLength(1);
    await clock.advance(1);

    expect(main.mode).toEqual({kind: 'window', bounds: FALLBACK_BOUNDS});
    expect(main.reloads).toBe(0);
    expect(main.destroyed).toBe(false);
    expect(windows.created).toHaveLength(2);
    manager.dispose();
    expect(displays.listenerCount).toBe(0);
    displays.dispose();
    expect(source.watcherCount).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('restores always on top when the removed monitor returns before settling', async () => {
    const clock = installFakeClock();
    const {source, displays, windows, manager} = setUpRemoval();
    const main = windows.only('main');

    source.remove(PROJECTOR.id);
    source.change(...[CONTROL, PROJECTOR, STAGE].map(displayInfo));
    await clock.advance(DISPLAY_SETTLE_MS);

    expect(main.mode).toMatchObject({kind: 'fullscreen', alwaysOnTop: true});
    expect(main.placements).toHaveLength(2);
    expect(main.reloads).toBe(0);
    manager.dispose();
    displays.dispose();
  });

  it('keeps other outputs running when a demotion fails', () => {
    installFakeClock();
    const {source, displays, windows, manager, log} = setUpRemoval([
      screenOn(PROJECTOR),
      screenOn(PROJECTOR, {id: 'stage'}),
    ]);
    vi.spyOn(
      windows.only('main'),
      'prepareForMonitorRemoval',
    ).mockImplementation(() => {
      throw new Error('window closed during demotion');
    });
    source.remove(PROJECTOR.id);
    expect(log.messages('error')).toEqual(['could not demote the main output']);
    expect(windows.only('stage').monitorRemovals).toBe(1);
    expect(windows.only('stage').mode).toMatchObject({
      kind: 'fullscreen',
      alwaysOnTop: false,
    });
    manager.dispose();
    displays.dispose();
  });

  it('opens the output full screen on its monitor when it turns on, and hides it when it turns off', () => {
    const {store, windows} = setUp();
    expect(windows.created).toHaveLength(1);
    store.dispatch(turn(true));
    const handle = windows.only('main');
    expect(handle.mode).toEqual({
      kind: 'fullscreen',
      bounds: PROJECTOR_BOUNDS,
      alwaysOnTop: true,
    });
    store.dispatch(turn(false));
    expect(handle.mode).toEqual({kind: 'hidden'});
  });

  it('leaves the windows alone when only the content changes', () => {
    const {store, source, windows} = setUp();
    store.dispatch(turn(true));
    const list = vi.spyOn(source, 'list');
    store.dispatch({
      type: 'slide.show',
      slide: {itemId: 'song', position: 0, label: null, lines: ['만복의 근원']},
    });
    store.dispatch({type: 'layer.clear', target: 'all'});
    expect(list).not.toHaveBeenCalled();
    expect(windows.only('main').placements).toHaveLength(1);
  });

  it('moves the output into a window on the control monitor when its monitor is unplugged, and back when it returns', () => {
    const {store, displays, windows, log} = setUp();
    store.dispatch(turn(true));
    const handle = windows.only('main');

    displays.plug(CONTROL, STAGE);
    expect(handle.mode).toEqual({kind: 'window', bounds: FALLBACK_BOUNDS});
    expect(log.messages('warn')).toEqual(['output monitor missing']);

    displays.plug(CONTROL, PROJECTOR, STAGE);
    expect(handle.mode).toMatchObject({
      kind: 'fullscreen',
      bounds: PROJECTOR_BOUNDS,
      alwaysOnTop: true,
    });
    expect(windows.created).toHaveLength(1);
    expect(handle.reloads).toBe(0);
    expect(store.state.outputs['main']).toBe(true);
  });

  it('reports the monitor number an output last showed full screen on, also after an unplug', () => {
    const {store, displays, manager} = setUp();
    expect(manager.screenStates().get('main')?.monitor).toBeUndefined();
    store.dispatch(turn(true));
    expect(manager.screenStates().get('main')).toMatchObject({
      placement: 'fullscreen',
      monitor: 2,
    });

    displays.plug(CONTROL, STAGE);
    expect(manager.screenStates().get('main')).toMatchObject({
      placement: 'monitorMissing',
      monitor: 2,
    });
  });

  it('raises only a windowed output for 창 보기', () => {
    const {store, displays, windows, manager} = setUp();
    store.dispatch(turn(true));
    const handle = windows.only('main');
    manager.showWindow('main');
    expect(handle.raises).toBe(0);

    displays.plug(CONTROL, STAGE);
    manager.showWindow('main');
    expect(handle.raises).toBe(1);
    expect(handle.mode).toEqual({kind: 'window', bounds: FALLBACK_BOUNDS});

    manager.showWindow('unknown');
    store.dispatch(turn(false));
    manager.showWindow('main');
    expect(handle.raises).toBe(1);
  });

  it('keeps an output on the monitor it found when a look-alike monitor connects', () => {
    const {store, displays, windows} = setUp();
    const found = {...PROJECTOR, id: 22, x: 3840};
    displays.plug(CONTROL, found);
    store.dispatch(turn(true));
    const handle = windows.only('main');
    expect(handle.mode).toMatchObject({bounds: {x: 3840}});

    displays.plug(CONTROL, {...PROJECTOR, id: 44}, found);
    expect(handle.mode).toMatchObject({kind: 'fullscreen', bounds: {x: 3840}});
  });

  it('turns the output off when its monitor is unplugged and 연결이 끊기면 says off', () => {
    const {store, displays, windows} = setUp([
      screenOn(PROJECTOR, {onDisconnect: 'off'}),
    ]);
    store.dispatch(turn(true));
    displays.plug(CONTROL);
    expect(store.state.outputs['main']).toBe(false);
    expect(windows.only('main').mode).toEqual({kind: 'hidden'});
  });

  it('shows an unassigned full screen output in a window', () => {
    const {store, windows} = setUp([fullScreenScreen({display: null})]);
    store.dispatch(turn(true));
    expect(windows.only('main').mode).toEqual({
      kind: 'window',
      bounds: FALLBACK_BOUNDS,
    });
  });

  it('opens no window and warns about nothing when a monitor goes away while the output is off', () => {
    const {store, displays, windows, log} = setUp();
    displays.plug(CONTROL);
    expect(windows.created).toHaveLength(1);
    expect(log.messages('warn')).toEqual([]);
    store.dispatch(turn(true));
    expect(windows.only('main').mode.kind).toBe('window');
  });

  it('turns the output off when the operator closes its window', () => {
    const {store, windows} = setUp([fullScreenScreen({method: 'window'})]);
    store.dispatch(turn(true));
    const handle = windows.only('main');
    handle.clickClose();
    expect(store.state.outputs['main']).toBe(false);
    expect(handle.mode).toEqual({kind: 'hidden'});
  });

  it('keeps the other outputs going when one window fails', () => {
    const store = new LiveStore();
    const windows = fakeWindows();
    const log = recordingLogger();
    const manager = new OutputManager({
      store,
      displays: new FakeMonitorFeed(monitorsOf(CONTROL, PROJECTOR, STAGE)),
      screens: new FakeScreenSource([
        screenOn(PROJECTOR),
        screenOn(STAGE, {id: 'stage'}),
      ]),
      controlBounds: () => CONTROL_WINDOW,
      createHandle: (screen, events) => {
        if (screen.id === 'main') throw new Error('no window today');
        return windows.create(screen, events);
      },
      log,
    });
    manager.start();
    simulateReadyFrames(manager, store, windows);
    store.dispatch(turn(true, 'main'));
    store.dispatch(turn(true, 'stage'));
    expect(windows.only('stage').mode.kind).toBe('fullscreen');
    expect(log.messages('error')).toContain(
      'could not update the main output window',
    );
  });

  it('closes the window of a screen that leaves the list', () => {
    const {store, source, windows} = setUp();
    store.dispatch(turn(true));
    source.screens = [];
    store.dispatch(turn(true, 'stage'));
    expect(windows.only('main').destroyed).toBe(true);
  });

  it('destroys every window and stops listening on dispose', () => {
    const {store, displays, windows, manager} = setUp();
    store.dispatch(turn(true));
    manager.dispose();
    expect(windows.only('main').destroyed).toBe(true);
    expect(store.listenerCount).toBe(0);
    expect(displays.listenerCount).toBe(0);
    store.dispatch(turn(false));
    expect(windows.only('main').mode.kind).toBe('fullscreen');
  });

  it('goes full screen on the projector once a failed first monitor read recovers', async () => {
    const clock = installFakeClock();
    const source = new FakeDisplaySource(
      displayInfo(CONTROL),
      displayInfo(PROJECTOR),
    );
    source.failure = new Error('display service starting');
    const log = recordingLogger();
    const displays = new DisplayRegistry(source, log);
    const store = new LiveStore();
    const windows = fakeWindows();
    const manager = new OutputManager({
      store,
      displays,
      screens: createDefaultScreenSource(displays),
      controlBounds: () => CONTROL_WINDOW,
      createHandle: windows.create,
      log,
    });
    manager.start();
    simulateReadyFrames(manager, store, windows);
    store.dispatch(turn(true));

    source.failure = null;
    await clock.advance(DISPLAY_RETRY_MS);
    await clock.advance(OUTPUT_REVEAL_DEADLINE_MS);
    expect(windows.only('main').mode).toEqual({
      kind: 'fullscreen',
      bounds: PROJECTOR_BOUNDS,
      alwaysOnTop: true,
    });
    manager.dispose();
    displays.dispose();
  });

  it("tells a restarted window when its page drew, and ignores other screens' reports", async () => {
    const clock = installFakeClock();
    const {store, windows, log, manager} = setUp();
    store.dispatch(turn(true));
    const handle = windows.only('main');
    for (let crash = 0; crash < CRASH_LIMIT; crash += 1) {
      handle.crash();
      await clock.advance(RELAUNCH_DELAY_MS);
    }
    await clock.advance(COOLDOWN_STEPS_MS[0] ?? 0);
    manager.frameReported('stage');
    expect(log.messages('info')).not.toContain(
      'output window restart attempt works',
    );
    manager.frameReported('main');
    expect(log.messages('info')).toContain(
      'output window restart attempt works',
    );
    manager.dispose();
  });

  it("reports each screen's placement and renderer state, and announces changes", async () => {
    const clock = installFakeClock();
    const store = new LiveStore();
    const windows = fakeWindows();
    const onStatusChange = vi.fn();
    const manager = new OutputManager({
      store,
      displays: new FakeMonitorFeed(monitorsOf(CONTROL, PROJECTOR)),
      screens: new FakeScreenSource([screenOn(PROJECTOR)]),
      controlBounds: () => CONTROL_WINDOW,
      createHandle: windows.create,
      log: recordingLogger(),
      onStatusChange,
    });
    manager.start();
    simulateReadyFrames(manager, store, windows);
    expect(manager.screenStates().get('main')).toEqual({
      placement: 'off',
      renderer: 'running',
    });
    store.dispatch(turn(true));
    expect(onStatusChange).toHaveBeenCalledTimes(1);
    expect(manager.screenStates().get('main')?.placement).toBe('fullscreen');

    const handle = windows.only('main');
    for (let crash = 0; crash < CRASH_LIMIT; crash += 1) {
      handle.crash();
      await clock.advance(RELAUNCH_DELAY_MS);
    }
    expect(manager.screenStates().get('main')?.renderer).toBe('limited');
    expect(onStatusChange.mock.calls.length).toBeGreaterThan(1);

    const reloadsBefore = handle.reloads;
    manager.retry('main');
    expect(handle.reloads).toBe(reloadsBefore + 1);
    manager.dispose();
  });
});
