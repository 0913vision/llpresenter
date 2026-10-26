import {EventEmitter} from 'node:events';
import {join} from 'node:path';
import {beforeEach, describe, expect, it, onTestFinished, vi} from 'vitest';
import type {LiveCommand} from '@shared/commands';
import {makeTempDir} from '../../test/temp-dir';
import type {LiveStore} from './live/store';

// NOTE(0913vision): Each test imports the whole main process afresh, which
// takes several seconds under coverage on a busy machine.
const ENTRY_TEST_TIMEOUT_MS = 30_000;

const fakes = vi.hoisted(() => {
  const order: string[] = [];
  const storeOptions: unknown[] = [];
  const mediaOptions: unknown[] = [];
  const soakSources: unknown[] = [];
  const outputContexts: Array<{readonly store: LiveStore}> = [];
  const scenarioDispatch: {current: ((command: LiveCommand) => void) | null} = {
    current: null,
  };
  const opened: {control: unknown} = {control: null};
  const appHandlers = new Map<string, Array<(...args: unknown[]) => void>>();
  return {
    order,
    overlayContexts: new Array<unknown>(),
    lookSelectionContexts: new Array<unknown>(),
    lookSelectionStop: vi.fn<() => void>(),
    selectLook: vi.fn(),
    recovery: {
      crashed: false,
      markQuitting: vi.fn<() => Promise<void>>(),
      cleanExit: vi.fn<() => Promise<void>>(),
    },
    recordOptions: new Array<unknown>(),
    writers: new Array<unknown>(),
    recoveryOptions: new Array<unknown>(),
    recoveryStart: vi.fn<() => Promise<void>>(),
    recoveryPorts: new Array<unknown>(),
    recoveryChannelsStop: vi.fn<() => void>(),
    macrosStartFresh: vi.fn<() => Promise<void>>(),
    recordStart: vi.fn<() => void>(),
    recordStop: vi.fn<() => void>(),
    recordSettled: vi.fn<() => Promise<void>>(),
    macroContexts: new Array<unknown>(),
    macrosStop: vi.fn<() => void>(),
    overlaysStop: vi.fn<() => void>(),
    settings: Promise.resolve(null),
    textImportContexts: new Array<unknown>(),
    textImportStop: vi.fn<() => void>(),
    bibleContexts: new Array<unknown>(),
    bibleStop: vi.fn<() => void>(),
    closeContexts: new Array<unknown>(),
    confirmClose: vi.fn<() => Promise<boolean>>(),
    closeStop: vi.fn<() => void>(),
    problemContexts: new Array<unknown>(),
    problemsStop: vi.fn<() => void>(),
    appHandlers,
    electron: {
      app: {
        setPath: vi.fn(),
        getPath: vi.fn<(name: string) => string>(),
        getVersion: () => '0.0.0',
        isPackaged: true,
        requestSingleInstanceLock: () => true,
        releaseSingleInstanceLock: vi.fn(),
        quit: vi.fn(),
        exit: vi.fn(),
        on: (event: string, handler: (...args: unknown[]) => void) => {
          appHandlers.set(event, [...(appHandlers.get(event) ?? []), handler]);
        },
        whenReady: () => Promise.resolve(),
      },
    },
    uiDispose: vi.fn<() => Promise<void>>(),
    zoom: {attachControl: vi.fn(), dispose: vi.fn()},
    zoomForControl: new Array<unknown>(),
    soakStop: vi.fn<() => Promise<void>>(),
    soakSources,
    scenarioStop: vi.fn<() => void>(),
    scenarioDispatch,
    outputsStop: vi.fn<() => void>(),
    outputContexts,
    frameRates: vi.fn<() => readonly unknown[]>(() => []),
    storeDispose: vi.fn<() => Promise<void>>(),
    appConfig: {flush: vi.fn<() => Promise<void>>()},
    storeOptions,
    findMediaFile: vi.fn<(mediaId: string) => Promise<string | null>>(),
    mediaRoots: vi.fn<() => readonly string[]>(),
    mediaOptions,
    opened,
    controlWindow: {
      isMinimized: vi.fn(() => true),
      restore: vi.fn(),
      focus: vi.fn(),
    },
  };
});

vi.mock('electron', () => fakes.electron);
vi.mock('./bible/register', () => ({
  registerBible: (context: unknown) => {
    fakes.bibleContexts.push(context);
    return fakes.bibleStop;
  },
}));
vi.mock('./live/recovery/session', () => ({
  RECOVERY_RECORD_FILE: 'live.json',
  openRecoverySession: async () => {
    fakes.order.push('recovery session');
    return fakes.recovery;
  },
}));
vi.mock('./live/recovery/recordWriter', () => ({
  openServiceIdOf: () => () => null,
  RecoveryRecordWriter: class {
    constructor(options: unknown) {
      fakes.recordOptions.push(options);
      fakes.writers.push(this);
    }
    start = fakes.recordStart;
    stop = fakes.recordStop;
    settled = fakes.recordSettled;
  },
}));
vi.mock('./live/recovery/controller', () => ({
  recoverySources: () => Promise.resolve(null),
  RecoveryController: class {
    constructor(options: unknown) {
      fakes.recoveryOptions.push(options);
    }
    start = fakes.recoveryStart;
  },
}));
vi.mock('./live/recovery/channels', () => ({
  registerRecoveryChannels: (port: unknown) => {
    fakes.recoveryPorts.push(port);
    return fakes.recoveryChannelsStop;
  },
}));
vi.mock('./macros/register', () => ({
  registerMacros: (context: unknown) => {
    fakes.macroContexts.push(context);
    return {dispose: fakes.macrosStop, startFresh: fakes.macrosStartFresh};
  },
}));
vi.mock('./live/overlays', () => ({
  startOverlays: (context: unknown) => {
    fakes.overlayContexts.push(context);
    return fakes.overlaysStop;
  },
}));
vi.mock('./live/lookSelection', () => ({
  registerLookSelection: (context: unknown) => {
    fakes.lookSelectionContexts.push(context);
    return fakes.lookSelectionStop;
  },
}));
vi.mock('./import/register', () => ({
  registerTextImport: (context: unknown) => {
    fakes.textImportContexts.push(context);
    return fakes.textImportStop;
  },
}));
vi.mock('./windows/controlClose', () => ({
  registerControlClose: (context: unknown) => {
    fakes.closeContexts.push(context);
    return {confirmClose: fakes.confirmClose, dispose: fakes.closeStop};
  },
}));
vi.mock('./store/uiZoom', () => ({
  registerUiZoom: vi.fn(() => {
    fakes.order.push('UI zoom');
    return fakes.zoom;
  }),
}));
vi.mock('./uiState/register', () => ({
  registerUiState: vi.fn(() => {
    fakes.order.push('ui state');
    return {dispose: fakes.uiDispose};
  }),
}));
vi.mock('./soak', () => ({
  registerSoakRecorder: (_log: unknown, sources: unknown) => {
    fakes.soakSources.push(sources);
    return fakes.soakStop;
  },
  registerSoakScenario: (
    _log: unknown,
    dispatch: (command: LiveCommand) => void,
  ) => {
    fakes.scenarioDispatch.current = dispatch;
    return fakes.scenarioStop;
  },
}));
vi.mock('./store/appConfigFile', () => ({
  openAppConfig: vi.fn(async () => {
    fakes.order.push('app.json');
    return fakes.appConfig;
  }),
}));
vi.mock('./store/register', () => ({
  registerStore: (options: unknown) => {
    fakes.order.push('data store');
    fakes.storeOptions.push(options);
    return {
      content: Promise.resolve(null),
      settings: fakes.settings,
      selectLook: fakes.selectLook,
      dispose: fakes.storeDispose,
      findMediaFile: fakes.findMediaFile,
      mediaRoots: fakes.mediaRoots,
    };
  },
}));
vi.mock('./ipc', () => ({registerIpc: () => () => undefined}));
vi.mock('./problemFeed', () => ({
  registerProblemFeed: (context: unknown) => {
    fakes.problemContexts.push(context);
    return {feed: {}, dispose: fakes.problemsStop};
  },
}));
vi.mock('./outputs/start', () => ({
  startOutputs: (context: {readonly store: LiveStore}) => {
    fakes.outputContexts.push(context);
    return {stop: fakes.outputsStop, frameRates: fakes.frameRates};
  },
}));
vi.mock('./windows/mediaProtocol', () => ({
  registerMediaScheme: () => undefined,
  serveMedia: (options: unknown) => {
    fakes.mediaOptions.push(options);
    return () => undefined;
  },
}));
vi.mock('./windows/control', () => ({
  createControlWindow: (_log: unknown, _mode: unknown, zoom: unknown) => {
    fakes.zoomForControl.push(zoom);
    fakes.order.push('control window');
    const win = Object.assign(new EventEmitter(), fakes.controlWindow);
    fakes.opened.control = win;
    return win;
  },
}));

async function startMain(): Promise<EventEmitter> {
  const before = new Set(process.listeners('uncaughtException'));
  const beforeRejections = new Set(process.listeners('unhandledRejection'));
  onTestFinished(() => {
    for (const listener of process.listeners('uncaughtException')) {
      if (!before.has(listener)) process.off('uncaughtException', listener);
    }
    for (const listener of process.listeners('unhandledRejection')) {
      if (!beforeRejections.has(listener)) {
        process.off('unhandledRejection', listener);
      }
    }
  });
  vi.resetModules();
  await import('./index');
  await vi.waitFor(() => expect(fakes.opened.control).not.toBeNull());
  const control = fakes.opened.control;
  if (!(control instanceof EventEmitter)) throw new Error('no control window');
  return control;
}

function deferred(): {promise: Promise<void>; resolve: () => void} {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>(done => {
    resolve = done;
  });
  return {promise, resolve};
}

beforeEach(async () => {
  fakes.electron.app.getPath.mockReturnValue(await makeTempDir());
  fakes.electron.app.quit.mockReset();
  fakes.electron.app.releaseSingleInstanceLock.mockClear();
  fakes.electron.app.isPackaged = true;
  fakes.controlWindow.restore.mockClear();
  fakes.controlWindow.focus.mockClear();
  fakes.order.length = 0;
  fakes.overlayContexts.length = 0;
  fakes.lookSelectionContexts.length = 0;
  fakes.lookSelectionStop.mockReset();
  fakes.selectLook.mockReset();
  fakes.recovery.crashed = false;
  fakes.recovery.markQuitting.mockReset();
  fakes.recovery.cleanExit.mockReset();
  fakes.recordOptions.length = 0;
  fakes.writers.length = 0;
  fakes.recoveryOptions.length = 0;
  fakes.recoveryStart.mockReset().mockResolvedValue(undefined);
  fakes.recoveryPorts.length = 0;
  fakes.recoveryChannelsStop.mockReset();
  fakes.macrosStartFresh.mockReset();
  fakes.recordStart.mockReset();
  fakes.recordStop.mockReset();
  fakes.recordSettled.mockReset();
  fakes.macroContexts.length = 0;
  fakes.macrosStop.mockReset();
  fakes.overlaysStop.mockReset();
  fakes.textImportContexts.length = 0;
  fakes.textImportStop.mockReset();
  fakes.bibleContexts.length = 0;
  fakes.bibleStop.mockReset();
  fakes.closeContexts.length = 0;
  fakes.confirmClose.mockReset().mockResolvedValue(true);
  fakes.closeStop.mockReset();
  fakes.problemContexts.length = 0;
  fakes.problemsStop.mockReset();
  fakes.appHandlers.clear();
  fakes.opened.control = null;
  fakes.uiDispose.mockReset();
  fakes.zoom.attachControl.mockReset();
  fakes.zoom.dispose.mockReset();
  fakes.zoomForControl.length = 0;
  fakes.soakStop.mockReset();
  fakes.soakSources.length = 0;
  fakes.scenarioStop.mockReset();
  fakes.scenarioDispatch.current = null;
  fakes.outputsStop.mockReset();
  fakes.outputContexts.length = 0;
  fakes.storeDispose.mockReset();
  fakes.appConfig.flush.mockReset();
  fakes.storeOptions.length = 0;
  fakes.mediaOptions.length = 0;
});

function launchAgain(): void {
  for (const handler of fakes.appHandlers.get('second-instance') ?? []) {
    handler();
  }
}

function beforeQuit(): {prevented: boolean} {
  const event = {
    prevented: false,
    preventDefault() {
      event.prevented = true;
    },
  };
  for (const handler of fakes.appHandlers.get('before-quit') ?? []) {
    handler(event);
  }
  return event;
}

describe('main entry wiring', {timeout: ENTRY_TEST_TIMEOUT_MS}, () => {
  it('connects Bible lookup to app-local files and stops it before closing data', async () => {
    await startMain();
    expect(fakes.bibleContexts).toEqual([
      expect.objectContaining({
        folder: join(fakes.electron.app.getPath('userData'), 'bible'),
        settings: fakes.settings,
      }),
    ]);
    beforeQuit();
    await vi.waitFor(() => expect(fakes.storeDispose).toHaveBeenCalledOnce());
    expect(fakes.bibleStop).toHaveBeenCalledOnce();
    expect(fakes.bibleStop.mock.invocationCallOrder[0]).toBeLessThan(
      fakes.storeDispose.mock.invocationCallOrder[0] ?? Infinity,
    );
  });
  it('starts a crashed session in standby and removes its marker after saving the data store', async () => {
    const finish = deferred();
    onTestFinished(finish.resolve);
    fakes.recovery.cleanExit.mockReturnValue(finish.promise);
    fakes.recovery.crashed = true;
    await startMain();
    expect(fakes.outputContexts[0]?.store.state.outputs).toEqual({});
    expect(fakes.macroContexts).toEqual([
      expect.objectContaining({launch: 'restore'}),
    ]);
    beforeQuit();
    await vi.waitFor(() =>
      expect(fakes.recovery.cleanExit).toHaveBeenCalledOnce(),
    );
    expect(fakes.storeDispose.mock.invocationCallOrder[0]).toBeLessThan(
      fakes.recovery.cleanExit.mock.invocationCallOrder[0] ?? Infinity,
    );
    expect(fakes.electron.app.releaseSingleInstanceLock).not.toHaveBeenCalled();
    expect(fakes.electron.app.quit).not.toHaveBeenCalled();
    finish.resolve();
    await vi.waitFor(() =>
      expect(fakes.electron.app.quit).toHaveBeenCalledOnce(),
    );
  });
  it('leaves a crashed launch, its record, and the held-back startup macros to recovery', async () => {
    fakes.recovery.crashed = true;
    await startMain();
    const userData = fakes.electron.app.getPath('userData');
    const file = join(userData, 'recovery', 'live.json');
    const store = fakes.outputContexts[0]?.store;
    expect(fakes.recordOptions).toMatchObject([{file, store}]);
    expect(fakes.recoveryOptions).toMatchObject([
      {
        crashed: true,
        file,
        store,
        record: fakes.writers[0],
        runStartupMacros: fakes.macrosStartFresh,
      },
    ]);
    expect(fakes.recoveryPorts).toHaveLength(1);
    expect(fakes.recoveryStart).toHaveBeenCalledOnce();
    expect(fakes.recordStart).not.toHaveBeenCalled();
  });

  it('starts recovery on a normal launch and marks quitting before anything else stops', async () => {
    const lastWrite = deferred();
    onTestFinished(lastWrite.resolve);
    fakes.recordSettled.mockReturnValue(lastWrite.promise);
    await startMain();
    expect(fakes.recoveryOptions).toMatchObject([{crashed: false}]);
    expect(fakes.recoveryStart).toHaveBeenCalledOnce();
    beforeQuit();
    await vi.waitFor(() => expect(fakes.recordSettled).toHaveBeenCalledOnce());
    const order = [
      fakes.recovery.markQuitting,
      fakes.recordStop,
      fakes.scenarioStop,
      fakes.outputsStop,
      fakes.appConfig.flush,
      fakes.storeDispose,
      fakes.recoveryChannelsStop,
      fakes.recordSettled,
    ].map(step => step.mock.invocationCallOrder[0] ?? Infinity);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(order.every(Number.isFinite)).toBe(true);
    expect(fakes.recovery.cleanExit).not.toHaveBeenCalled();
    lastWrite.resolve();
    await vi.waitFor(() =>
      expect(fakes.recovery.cleanExit).toHaveBeenCalledOnce(),
    );
  });

  it('connects macro execution to the shared live and data stores and stops it before closing data', async () => {
    await startMain();
    expect(fakes.macroContexts[0]).toHaveProperty('launch', 'normal');
    expect(fakes.macroContexts).toHaveLength(1);
    expect(fakes.macroContexts[0]).toHaveProperty(
      'store',
      fakes.outputContexts[0]?.store,
    );
    expect(fakes.macroContexts[0]).toHaveProperty(
      'data.settings',
      fakes.settings,
    );
    beforeQuit();
    await vi.waitFor(() => expect(fakes.storeDispose).toHaveBeenCalledOnce());
    expect(fakes.macrosStop).toHaveBeenCalledOnce();
    expect(fakes.macrosStop.mock.invocationCallOrder[0]).toBeLessThan(
      fakes.storeDispose.mock.invocationCallOrder[0] ?? Infinity,
    );
  });
  it('connects overlay settings to the live store and stops overlays before closing the data store', async () => {
    await startMain();
    expect(fakes.overlayContexts).toEqual([
      expect.objectContaining({
        store: fakes.outputContexts[0]?.store,
        settings: fakes.settings,
      }),
    ]);
    expect(fakes.outputContexts).toEqual([
      expect.objectContaining({settings: fakes.settings}),
    ]);
    beforeQuit();
    await vi.waitFor(() => expect(fakes.storeDispose).toHaveBeenCalledOnce());
    expect(fakes.overlaysStop).toHaveBeenCalledOnce();
    expect(fakes.overlaysStop.mock.invocationCallOrder[0]).toBeLessThan(
      fakes.storeDispose.mock.invocationCallOrder[0] ?? Infinity,
    );
  });

  it('registers text import for the control window and removes its handlers on shutdown', async () => {
    await startMain();
    expect(fakes.textImportContexts).toEqual([
      expect.objectContaining({
        control: fakes.opened.control,
        windowMode: 'normal',
      }),
    ]);
    beforeQuit();
    await vi.waitFor(() => expect(fakes.textImportStop).toHaveBeenCalledOnce());
  });

  it('asks the control window to flush before saving and keeps running when it refuses', async () => {
    fakes.confirmClose.mockResolvedValueOnce(false);
    await startMain();
    expect(fakes.closeContexts).toEqual([
      expect.objectContaining({control: fakes.opened.control}),
    ]);
    expect(beforeQuit().prevented).toBe(true);
    await vi.waitFor(() => expect(fakes.confirmClose).toHaveBeenCalledOnce());
    await new Promise(resolve => setImmediate(resolve));
    expect(fakes.scenarioStop).not.toHaveBeenCalled();
    expect(fakes.uiDispose).not.toHaveBeenCalled();
    expect(fakes.electron.app.quit).not.toHaveBeenCalled();
    expect(beforeQuit().prevented).toBe(true);
    await vi.waitFor(() =>
      expect(fakes.electron.app.quit).toHaveBeenCalledOnce(),
    );
    expect(fakes.confirmClose).toHaveBeenCalledTimes(2);
    expect(fakes.confirmClose.mock.invocationCallOrder[1]).toBeLessThan(
      fakes.scenarioStop.mock.invocationCallOrder[0] ?? -Infinity,
    );
    expect(fakes.closeStop).toHaveBeenCalledOnce();
    expect(fakes.storeDispose.mock.invocationCallOrder[0]).toBeLessThan(
      fakes.closeStop.mock.invocationCallOrder[0] ?? -Infinity,
    );
  });

  it('reports the live store problems to the windows and stops on shutdown', async () => {
    await startMain();
    expect(fakes.problemContexts).toEqual([
      expect.objectContaining({store: fakes.outputContexts[0]?.store}),
    ]);
    beforeQuit();
    await vi.waitFor(() =>
      expect(fakes.electron.app.quit).toHaveBeenCalledOnce(),
    );
    expect(fakes.problemsStop).toHaveBeenCalledOnce();
  });

  it('registers the required Look writer and releases it before closing data', async () => {
    await startMain();
    expect(fakes.lookSelectionContexts).toMatchObject([
      {
        store: fakes.outputContexts[0]?.store,
        selection: {selectLook: fakes.selectLook},
      },
    ]);
    beforeQuit();
    await vi.waitFor(() => expect(fakes.storeDispose).toHaveBeenCalledOnce());
    expect(fakes.lookSelectionStop).toHaveBeenCalledOnce();
    expect(fakes.lookSelectionStop.mock.invocationCallOrder[0]).toBeLessThan(
      fakes.storeDispose.mock.invocationCallOrder[0] ?? Infinity,
    );
  });

  it('reads the UI state before the control window opens', async () => {
    await startMain();
    expect(fakes.order).toEqual([
      'recovery session',
      'app.json',
      'ui state',
      'UI zoom',
      'data store',
      'control window',
    ]);
  });

  it('passes the shared zoom registration only to the control window and disposes it before saving app.json', async () => {
    await startMain();
    expect(fakes.zoomForControl).toEqual([fakes.zoom]);
    beforeQuit();
    await vi.waitFor(() => expect(fakes.appConfig.flush).toHaveBeenCalled());
    expect(fakes.zoom.dispose).toHaveBeenCalledOnce();
    expect(fakes.zoom.dispose.mock.invocationCallOrder[0]).toBeLessThan(
      fakes.appConfig.flush.mock.invocationCallOrder[0] ?? Infinity,
    );
  });

  it('tells the data store whether an output is on', async () => {
    await startMain();

    expect(fakes.storeOptions).toHaveLength(1);
    expect(fakes.storeOptions[0]).toHaveProperty('log');
    expect(fakes.storeOptions[0]).toHaveProperty('isAnyOutputOn');
  });

  it('gives the data store the app.json it opened first', async () => {
    await startMain();

    expect(fakes.storeOptions[0]).toHaveProperty('appConfig', fakes.appConfig);
  });

  it('saves app.json on quit, after the UI state', async () => {
    const ui = deferred();
    fakes.uiDispose.mockReturnValue(ui.promise);
    fakes.soakStop.mockResolvedValue(undefined);
    await startMain();

    beforeQuit();
    await new Promise(resolve => setImmediate(resolve));
    expect(fakes.appConfig.flush).not.toHaveBeenCalled();
    ui.resolve();

    await vi.waitFor(() => {
      expect(fakes.appConfig.flush).toHaveBeenCalledTimes(1);
    });
  });

  it('serves media through the data store lookup', async () => {
    await startMain();

    expect(fakes.mediaOptions).toHaveLength(1);
    expect(fakes.mediaOptions[0]).toHaveProperty(
      'resolvePath',
      fakes.findMediaFile,
    );
    expect(fakes.mediaOptions[0]).toHaveProperty(
      'mediaRoots',
      fakes.mediaRoots,
    );
  });

  it('asks to quit when the control window closes', async () => {
    const control = await startMain();
    control.emit('closed');
    expect(fakes.electron.app.quit).toHaveBeenCalledTimes(1);
  });

  it('holds the quit until the UI state and the soak record are written', async () => {
    const ui = deferred();
    const soak = deferred();
    fakes.uiDispose.mockReturnValue(ui.promise);
    fakes.soakStop.mockReturnValue(soak.promise);
    await startMain();
    expect(beforeQuit().prevented).toBe(true);
    expect(beforeQuit().prevented).toBe(true);
    ui.resolve();
    await ui.promise;
    await new Promise(resolve => setImmediate(resolve));
    expect(fakes.electron.app.quit).not.toHaveBeenCalled();
    soak.resolve();
    await vi.waitFor(() => {
      expect(fakes.electron.app.quit).toHaveBeenCalledTimes(1);
    });
    expect(fakes.uiDispose).toHaveBeenCalledTimes(1);
    expect(fakes.storeDispose).toHaveBeenCalledTimes(1);
    expect(fakes.electron.app.releaseSingleInstanceLock).toHaveBeenCalled();
    expect(beforeQuit().prevented).toBe(false);
  });

  it('still quits when saving fails', async () => {
    fakes.uiDispose.mockRejectedValue(new Error('disk full'));
    fakes.soakStop.mockResolvedValue(undefined);
    await startMain();
    beforeQuit();
    await vi.waitFor(() => {
      expect(fakes.electron.app.quit).toHaveBeenCalled();
    });
  });

  it('restores and focuses the control window on a second launch', async () => {
    await startMain();

    launchAgain();

    expect(fakes.controlWindow.restore).toHaveBeenCalledTimes(1);
    expect(fakes.controlWindow.focus).toHaveBeenCalledTimes(1);
  });

  it('keeps an offscreen control window hidden on a second launch', async () => {
    fakes.electron.app.isPackaged = false;
    vi.stubEnv('LLP_TEST_WINDOWS', 'offscreen');
    await startMain();

    launchAgain();

    expect(fakes.controlWindow.restore).not.toHaveBeenCalled();
    expect(fakes.controlWindow.focus).not.toHaveBeenCalled();
  });

  it("gives the soak recorder the outputs' frame rates", async () => {
    await startMain();

    expect(fakes.soakSources).toEqual([{frameRates: fakes.frameRates}]);
  });

  it('lets the soak scenario change the live state', async () => {
    await startMain();
    const store = fakes.outputContexts[0]?.store;

    fakes.scenarioDispatch.current?.({
      type: 'output.set',
      screenId: 'main',
      on: true,
    });

    expect(store?.state.outputs).toEqual({main: true});
  });

  it('stops the soak scenario before the outputs when quitting', async () => {
    const stopped: string[] = [];
    fakes.scenarioStop.mockImplementation(() => {
      stopped.push('soak scenario');
    });
    fakes.outputsStop.mockImplementation(() => {
      stopped.push('outputs');
    });
    fakes.uiDispose.mockResolvedValue(undefined);
    fakes.soakStop.mockResolvedValue(undefined);
    fakes.storeDispose.mockResolvedValue(undefined);
    await startMain();

    beforeQuit();

    await vi.waitFor(() => {
      expect(fakes.electron.app.quit).toHaveBeenCalled();
    });
    expect(stopped).toEqual(['soak scenario', 'outputs']);
  });

  it('quits when the last window closes, through the same shutdown', async () => {
    await startMain();
    for (const handler of fakes.appHandlers.get('window-all-closed') ?? []) {
      handler();
    }
    expect(fakes.electron.app.quit).toHaveBeenCalledTimes(1);
  });
});
