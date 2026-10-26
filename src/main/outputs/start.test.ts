import {BrowserWindow} from 'electron';
import {beforeEach, describe, expect, it, onTestFinished, vi} from 'vitest';
import {Channels} from '@shared/ipc';
import {parseLiveCommand} from '@shared/schema/liveCommand';
import type {SettingsReader} from '../store/settingsStore';
import type {MessageHandler} from '../rendererMessages';
import {
  FakeDisplaySource,
  displayInfo,
  recordingLogger,
} from '../displays/testing';
import {intersectionArea} from '../displays/rect';
import {dispatchLogged, LiveStore} from '../live/store';
import {startOverlays} from '../live/overlays';
import {
  CAPTIONS,
  MAIN,
  STAGE,
  overlaySettings,
  settingsDocument,
} from '../live/testing/overlays';
import type {WindowMode} from '../windows/testWindows';
import {fakeWindows, type FakeWindows} from './testing';
import {openNumberWindow} from './numberWindow';
import {sendToWindows} from '../ipc';
import {startOutputs} from './start';

const fakes = vi.hoisted(() => {
  const inputs: {
    displays: FakeDisplaySource | null;
    windows: FakeWindows | null;
  } = {displays: null, windows: null};
  return {
    ...inputs,
    handlers: new Map<string, MessageHandler>(),
    answers: new Map<string, () => unknown>(),
    start: vi.fn(() => 7),
    stop: vi.fn(),
    closeNumber: vi.fn(),
  };
});
vi.mock('electron', () => ({
  BrowserWindow: class {
    isDestroyed() {
      return false;
    }
    getBounds() {
      return {x: 0, y: 0, width: 1920, height: 1040};
    }
  },
  powerSaveBlocker: {
    start: fakes.start,
    stop: fakes.stop,
    isStarted: () => true,
  },
}));
vi.mock('../displays/electronSource', () => ({
  createElectronDisplaySource: () => {
    if (fakes.displays === null) throw new Error('Missing displays');
    return fakes.displays;
  },
}));
vi.mock('./electronWindow', () => ({
  createElectronOutputWindow: (...args: Parameters<FakeWindows['create']>) => {
    if (fakes.windows === null) throw new Error('Missing windows');
    return fakes.windows.create(...args);
  },
}));
vi.mock('./numberWindow', () => ({
  openNumberWindow: vi.fn(() => ({close: fakes.closeNumber})),
}));
vi.mock('../ipc', () => ({
  listenToWindows: (channel: string, handler: MessageHandler) => {
    fakes.handlers.set(channel, handler);
    return () => {
      fakes.handlers.delete(channel);
    };
  },
  answerWindows: (channel: string, answer: () => unknown) => {
    fakes.answers.set(channel, answer);
    return () => {
      fakes.answers.delete(channel);
    };
  },
  sendToWindows: vi.fn(),
}));

const projector = displayInfo({id: 2, x: 1920});
const stage = displayInfo({id: 3, x: 3840});
const savedDisplay = ({id, name, bounds, scaleFactor}: typeof projector) => ({
  id,
  name,
  bounds,
  scaleFactor,
  number: id,
});
const main = {
  id: MAIN,
  name: 'Main',
  kind: 'audience',
  method: 'fullscreen',
  display: savedDisplay(projector),
};

beforeEach(() => {
  vi.clearAllMocks();
  fakes.displays = new FakeDisplaySource(
    displayInfo({id: 1, primary: true}),
    projector,
    stage,
  );
  fakes.windows = fakeWindows();
  fakes.handlers.clear();
  fakes.answers.clear();
});

function setup(
  loading?: Promise<SettingsReader | null>,
  windowMode: WindowMode = 'offscreen',
) {
  const settings = overlaySettings();
  settings.update(settingsDocument('screens', {screens: [main]}));
  const store = new LiveStore();
  const log = recordingLogger();
  const settingsPromise = loading ?? Promise.resolve(settings.reader);
  const stopOverlays = startOverlays({store, settings: settingsPromise, log});
  const running = startOutputs({
    store,
    settings: settingsPromise,
    control: new BrowserWindow({
      show: false,
      webPreferences: {offscreen: true},
    }),
    log,
    windowMode,
  });
  const stop = (): void => {
    running.stop();
    stopOverlays();
  };
  onTestFinished(stop);
  const windows = fakes.windows;
  if (windows === null) throw new Error('Missing windows');
  const save = (screens: readonly object[]): void =>
    settings.update(settingsDocument('screens', {screens}));
  return {settings, store, log, running, windows, save, stop, stopOverlays};
}

async function loaded() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('saved output backend', () => {
  it.each(['refused', 'failed'] as const)(
    'keeps the built-in output usable when settings are %s',
    async reason => {
      const loading =
        reason === 'refused'
          ? Promise.resolve(null)
          : Promise.reject(new Error('cannot open settings'));
      const {store, windows, running, log} = setup(loading);
      store.dispatch({type: 'output.set', screenId: 'main', on: true});
      await loaded();
      expect(store.state.outputs.main).toBe(true);
      const output = windows.only('main');
      expect(output.mode).toEqual({
        kind: 'fullscreen',
        bounds: projector.bounds,
        alwaysOnTop: true,
      });
      expect(log.messages('warn')).toContain(
        'using built-in output screens because settings are unavailable',
      );
      fakes.handlers.get(Channels.outputFrameRate)?.(
        {screenId: 'main', fps: 60},
        1,
      );
      expect(running.frameRates()).toEqual([{screen: 'main', fps: 60}]);
      store.dispatch({type: 'output.set', screenId: 'main', on: false});
      expect(output.mode.kind).toBe('hidden');
      store.dispatch({type: 'output.set', screenId: 'main', on: true});
      expect(output.mode.kind).toBe('fullscreen');
      expect(windows.created).toHaveLength(1);
    },
  );

  it('keeps the single settings owner attached when only outputs stop', async () => {
    const connect = vi.spyOn(LiveStore.prototype, 'connectSettings');
    const {store, settings, running, stopOverlays} = setup();
    await loaded();
    expect(connect).toHaveBeenCalledTimes(1);
    running.stop();
    store.dispatch({type: 'output.set', screenId: 'main', on: true});
    expect(store.state.outputs).toEqual({[MAIN]: true, main: true});
    stopOverlays();
    expect(settings.listeners.size).toBe(0);
    expect(store.listenerCount).toBe(0);
  });
  it('reads saved settings by ID for resync and coalesces refreshes after the live transaction', async () => {
    const {settings, store, log, running, windows} = setup();
    await loaded();
    const command = parseLiveCommand({
      type: 'screen.settings.apply',
      screenId: MAIN,
      screen: {...main, method: 'window'},
    });
    if (!command.ok || command.value.type !== 'screen.settings.apply') {
      throw new Error('Invalid resync fixture');
    }
    const read = settings.reader.get.bind(settings.reader);
    const saved = settingsDocument('screens', {
      screens: [
        {...main, method: 'capture', resolution: {width: 1280, height: 720}},
      ],
    });
    const get = vi
      .spyOn(settings.reader, 'get')
      .mockImplementation(name => (name === 'screens' ? saved : read(name)));
    const broadcasts = vi.fn();
    store.subscribe(broadcasts);
    dispatchLogged(
      store,
      {
        type: 'live.batch',
        commands: [
          command.value,
          command.value,
          {type: 'output.set', screenId: MAIN, on: true},
        ],
      },
      log,
    );
    expect(broadcasts).toHaveBeenCalledTimes(1);
    expect(windows.only(MAIN).mode.kind).toBe('fullscreen');
    get.mockClear();
    await loaded();
    expect(get.mock.calls.filter(([name]) => name === 'screens')).toHaveLength(
      1,
    );
    expect(store.state.outputs[MAIN]).toBe(true);
    expect(windows.only(MAIN).mode).toMatchObject({
      kind: 'capture',
      bounds: {width: 1280, height: 720},
    });
    expect(broadcasts).toHaveBeenCalledTimes(1);
    const before = store.state;
    dispatchLogged(
      store,
      {type: 'screen.settings.apply', screenId: STAGE},
      log,
    );
    expect(store.state).toBe(before);
    expect(log.entries.at(-1)).toMatchObject({
      level: 'warn',
      detail: {reason: 'missing-target', target: {kind: 'screen', id: STAGE}},
    });
    running.stop();
    dispatchLogged(store, command.value, log);
    expect(log.entries.at(-1)).toMatchObject({
      level: 'error',
      message: 'live command failed',
    });
  });

  it('applies method, monitor, resolution and always-on-top changes to the same window', async () => {
    const {save, store, windows} = setup();
    await loaded();
    const broadcasts = vi.fn();
    store.subscribe(broadcasts);
    store.dispatch({type: 'output.set', screenId: 'main', on: true});
    expect(store.state.outputs).toEqual({[MAIN]: true, main: true});
    expect(broadcasts).toHaveBeenCalledTimes(1);
    const window = windows.only(MAIN);
    expect(window.mode).toEqual({
      kind: 'fullscreen',
      bounds: projector.bounds,
      alwaysOnTop: true,
    });
    save([
      {...main, method: 'capture', resolution: {width: 1280, height: 720}},
    ]);
    expect(window.mode).toMatchObject({
      kind: 'capture',
      bounds: {width: 1280, height: 720},
    });
    expect(window.mode).not.toHaveProperty('alwaysOnTop', true);
    save([
      {
        ...main,
        method: 'capture',
        resolution: {width: 3840, height: 2160},
        alwaysOnTop: true,
      },
    ]);
    expect(window.mode).toMatchObject({
      kind: 'capture',
      bounds: {width: 3840, height: 2160},
      alwaysOnTop: true,
    });
    save([{...main, method: 'window', alwaysOnTop: true}]);
    expect(window.mode).toMatchObject({kind: 'window', alwaysOnTop: true});
    save([{...main, display: savedDisplay(stage), alwaysOnTop: false}]);
    expect(window.mode).toEqual({
      kind: 'fullscreen',
      bounds: stage.bounds,
      alwaysOnTop: false,
    });
    expect(windows.created).toHaveLength(1);
    expect(fakes.start).toHaveBeenCalledExactlyOnceWith(
      'prevent-display-sleep',
    );
    store.dispatch({type: 'output.set', screenId: MAIN, on: false});
    expect(store.state.outputs).toEqual({[MAIN]: false, main: false});
    expect(window.mode.kind).toBe('hidden');
    expect(fakes.stop).toHaveBeenCalledExactlyOnceWith(7);
  });

  it('loads output commands queued before settings are ready', async () => {
    let resolve: (reader: SettingsReader) => void = () => undefined;
    const loading = new Promise<SettingsReader>(done => {
      resolve = done;
    });
    const {settings, store, windows, running} = setup(loading);
    store.dispatch({type: 'output.set', screenId: 'main', on: true});
    expect(windows.created).toHaveLength(0);
    resolve(settings.reader);
    await loaded();
    expect(store.state.outputs).toEqual({[MAIN]: true, main: true});
    expect(windows.only(MAIN).mode.kind).toBe('fullscreen');
    running.stop();
    expect(fakes.stop).toHaveBeenCalledExactlyOnceWith(7);
  });

  it('uses the latest settings before the first native handle exists', async () => {
    const {save, store, windows} = setup();
    await loaded();
    save([{...main, name: 'Updated', method: 'capture'}]);
    store.dispatch({type: 'output.set', screenId: MAIN, on: true});
    expect(windows.only(MAIN).screen).toMatchObject({
      name: 'Updated',
      method: 'capture',
    });
  });

  it('releases the last wake lock for removed or unsupported screens even without monitors', async () => {
    const {settings, store, windows, stop, log, save} = setup();
    await loaded();
    save([main, {...main, id: STAGE, method: 'window'}]);
    store.dispatch({
      type: 'live.batch',
      commands: [MAIN, STAGE].map(screenId => ({
        type: 'output.set',
        screenId,
        on: true,
      })),
    });
    save([{...main, id: STAGE, method: 'window'}]);
    expect(windows.only(MAIN).destroyed).toBe(true);
    expect(fakes.stop).not.toHaveBeenCalled();
    fakes.displays?.change();
    save([{...main, id: STAGE, method: 'ndi'}]);
    expect(windows.only(STAGE).destroyed).toBe(true);
    expect(Object.values(store.state.outputs).some(Boolean)).toBe(false);
    expect(fakes.stop).toHaveBeenCalledExactlyOnceWith(7);
    dispatchLogged(store, {type: 'output.set', screenId: STAGE, on: true}, log);
    expect(fakes.start).toHaveBeenCalledTimes(1);
    expect(log.entries.at(-1)).toMatchObject({
      level: 'warn',
      detail: {reason: 'missing-target'},
    });
    stop();
    stop();
    expect(store.listenerCount).toBe(0);
    expect(settings.listeners.size).toBe(0);
    expect(fakes.displays?.watcherCount).toBe(0);
    expect(fakes.handlers.size + fakes.answers.size).toBe(0);
  });

  it('shows monitor numbers while running, opening no window offscreen', async () => {
    const {store, stop} = setup();
    await loaded();
    const skipped = vi.fn();
    store.dispatch({type: 'monitors.identify'}, undefined, skipped);
    expect(skipped).not.toHaveBeenCalled();
    expect(vi.mocked(openNumberWindow)).not.toHaveBeenCalled();
    stop();
    store.dispatch({type: 'monitors.identify'}, undefined, skipped);
    expect(skipped).toHaveBeenCalledWith(
      expect.objectContaining({reason: 'failed'}),
    );
  });

  it('opens a number window on each monitor away from a shown capture window', async () => {
    const {store, save, windows, stop} = setup(undefined, 'normal');
    await loaded();
    save([
      {...main, method: 'capture', resolution: {width: 1280, height: 720}},
    ]);
    store.dispatch({type: 'output.set', screenId: MAIN, on: true});
    const capture = windows.only(MAIN).bounds();
    if (capture === null) throw new Error('Missing capture window');
    store.dispatch({type: 'monitors.identify'});
    const spots = vi.mocked(openNumberWindow).mock.calls.map(([spot]) => spot);
    expect(spots.map(({number}) => number)).toEqual([1, 2, 3]);
    for (const {bounds} of spots) {
      expect(intersectionArea(bounds, capture)).toBe(0);
    }
    expect(fakes.closeNumber).not.toHaveBeenCalled();
    stop();
    expect(fakes.closeNumber).toHaveBeenCalledTimes(3);
  });

  it('reads the monitors at once for 모니터 다시 찾기 and raises the fallback for 창 보기', async () => {
    const {store, windows, log} = setup();
    await loaded();
    store.dispatch({type: 'output.set', screenId: 'main', on: true});
    const output = windows.only(MAIN);
    expect(output.mode.kind).toBe('fullscreen');
    const displays = fakes.displays;
    if (displays === null) throw new Error('Missing displays');
    displays.displays = [displayInfo({id: 1, primary: true}), stage];

    fakes.handlers.get(Channels.outputFindMonitors)?.(undefined, 1);
    expect(output.mode.kind).toBe('window');
    expect(fakes.answers.get(Channels.outputStatusGet)?.()).toMatchObject({
      main: {placement: 'monitorMissing', monitor: 2},
    });

    fakes.handlers.get(Channels.outputShowWindow)?.({screenId: 'main'}, 1);
    expect(output.raises).toBe(1);
    fakes.handlers.get(Channels.outputShowWindow)?.({screenId: ''}, 1);
    expect(output.raises).toBe(1);
    expect(log.messages('warn')).toContain(
      'dropped a malformed show window request',
    );
  });

  it('routes capture aliases and frame statuses by UUID and forgets removed reports', async () => {
    const {save, store, running, windows} = setup();
    await loaded();
    save([{...main, id: CAPTIONS, method: 'window'}]);
    store.dispatch({type: 'output.set', screenId: 'captions', on: true});
    expect(store.state.outputs).toEqual({
      [CAPTIONS]: true,
      broadcast: true,
      captions: true,
    });
    fakes.handlers.get(Channels.outputFrameRate)?.(
      {screenId: CAPTIONS, fps: 60},
      1,
    );
    expect(running.frameRates()).toEqual([{screen: CAPTIONS, fps: 60}]);
    expect(fakes.answers.get(Channels.outputStatusGet)?.()).toMatchObject({
      broadcast: {fps: 60},
      captions: {fps: 60},
      [CAPTIONS]: {fps: 60},
    });
    expect(windows.only(CAPTIONS).mode.kind).toBe('window');
    save([]);
    save([{...main, id: CAPTIONS, method: 'window'}]);
    expect(running.frameRates()).toEqual([]);
  });

  it('answers the monitor list and pushes it when the monitors change', async () => {
    const {stop} = setup();
    await loaded();
    const numbers = () =>
      (fakes.answers.get(Channels.monitorsGet)?.() as {number: number}[]).map(
        monitor => monitor.number,
      );
    expect(numbers()).toEqual([1, 2, 3]);

    const displays = fakes.displays;
    if (displays === null) throw new Error('Missing displays');
    displays.displays = [displayInfo({id: 1, primary: true}), stage];
    fakes.handlers.get(Channels.outputFindMonitors)?.(undefined, 1);

    expect(numbers()).toEqual([1, 2]);
    expect(vi.mocked(sendToWindows)).toHaveBeenCalledWith(
      Channels.monitorsChanged,
      expect.arrayContaining([expect.objectContaining({number: 2})]),
      expect.anything(),
    );
    stop();
    expect(fakes.answers.has(Channels.monitorsGet)).toBe(false);
  });
});
