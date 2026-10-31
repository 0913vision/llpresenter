import {EventEmitter} from 'node:events';
import {join} from 'node:path';
import {beforeEach, describe, expect, it, onTestFinished, vi} from 'vitest';
import type {LiveCommand} from '@core/live/commands';
import {makeTempDir} from '../../test/temp-dir';
import type {LiveStore} from './live/store';
import type {MediaBackendRegistration} from './media/register';
import type {MediaHandlerOptions} from './windows/mediaResponse';
import type {BibleLookupSession} from './bible/lookup';

// NOTE(0913vision): Each test imports the whole main process afresh, which
// takes several seconds under coverage on a busy machine.
const ENTRY_TEST_TIMEOUT_MS = 30_000;

const mocks = vi.hoisted(() => {
  const order: string[] = [];
  const storeOptions: unknown[] = [];
  const mediaOptions: MediaHandlerOptions[] = [];
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
    audioContexts: new Array<unknown>(),
    audioStop: vi.fn<() => void>(),
    lookSelectionContexts: new Array<unknown>(),
    lookSelectionStop: vi.fn<() => void>(),
    themeOutputContexts: new Array<unknown>(),
    themeOutputStop: vi.fn<() => void>(),
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
    screensWindowContexts: new Array<unknown>(),
    screensWindowStop: vi.fn<() => void>(),
    screensWindowClose: vi.fn<() => Promise<boolean>>(),
    bibleContexts: new Array<unknown>(),
    bible: {lookup: vi.fn<BibleLookupSession['lookup']>()},
    bibleStop: vi.fn<() => void>(),
    fontContexts: new Array<unknown>(),
    fontsStop: vi.fn<() => void>(),
    mediaBackendContexts: new Array<MediaBackendRegistration>(),
    analysisOptions: new Array<unknown>(),
    analysis: {
      lentFile: vi.fn<(token: string) => string | null>(() => 'a.mp4'),
      analyse: vi.fn(),
      thumbnailOf: vi.fn<(mediaId: string) => Promise<string | null>>(() =>
        Promise.resolve('thumb.jpg'),
      ),
      saveThumbnail: vi.fn(),
      dispose: vi.fn<() => void>(),
    },
    mediaBackendStop: vi.fn<() => Promise<void>>(),
    closeContexts: new Array<unknown>(),
    confirmClose: vi.fn<() => Promise<boolean>>(),
    closeStop: vi.fn<() => void>(),
    problemContexts: new Array<unknown>(),
    problemsStop: vi.fn<() => void>(),
    problemFeed: {report: vi.fn(), push: vi.fn(), addStanding: vi.fn()},
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

vi.mock('electron', () => mocks.electron);
vi.mock('./windows/screens', () => ({
  registerScreensWindow: (context: unknown) => {
    mocks.screensWindowContexts.push(context);
    return {close: mocks.screensWindowClose, dispose: mocks.screensWindowStop};
  },
}));
vi.mock('./bible/register', () => ({
  registerBible: (context: unknown) => {
    mocks.bibleContexts.push(context);
    return mocks.bibleStop;
  },
}));
vi.mock('./fonts/register', () => ({
  registerFonts: (control: unknown, log: unknown) => {
    mocks.fontContexts.push({control, log});
    return mocks.fontsStop;
  },
}));
vi.mock('./live/recovery/session', () => ({
  RECOVERY_RECORD_FILE: 'live.json',
  openRecoverySession: async () => {
    mocks.order.push('recovery session');
    return mocks.recovery;
  },
}));
vi.mock('./live/recovery/recordWriter', () => ({
  openServiceIdOf: () => () => null,
  RecoveryRecordWriter: class {
    constructor(options: unknown) {
      mocks.recordOptions.push(options);
      mocks.writers.push(this);
    }
    start = mocks.recordStart;
    stop = mocks.recordStop;
    settled = mocks.recordSettled;
  },
}));
vi.mock('./live/recovery/controller', () => ({
  recoverySources: () => Promise.resolve(null),
  RecoveryController: class {
    constructor(options: unknown) {
      mocks.recoveryOptions.push(options);
    }
    start = mocks.recoveryStart;
  },
}));
vi.mock('./live/recovery/channels', () => ({
  registerRecoveryChannels: (port: unknown) => {
    mocks.recoveryPorts.push(port);
    return mocks.recoveryChannelsStop;
  },
}));
vi.mock('./macros/register', () => ({
  registerMacros: (context: unknown) => {
    mocks.macroContexts.push(context);
    return {dispose: mocks.macrosStop, startFresh: mocks.macrosStartFresh};
  },
}));
vi.mock('./windows/audio', () => ({
  registerAudioOutput: (context: unknown) => {
    mocks.audioContexts.push(context);
    return mocks.audioStop;
  },
}));
vi.mock('./live/overlays', () => ({
  startOverlays: (context: unknown) => {
    mocks.overlayContexts.push(context);
    return mocks.overlaysStop;
  },
}));
vi.mock('./live/lookSelection', () => ({
  registerLookSelection: (context: unknown) => {
    mocks.lookSelectionContexts.push(context);
    return mocks.lookSelectionStop;
  },
}));
vi.mock('./live/themes', () => ({
  registerThemeOutput: (context: unknown) => {
    mocks.themeOutputContexts.push(context);
    return mocks.themeOutputStop;
  },
}));
vi.mock('./media/analysis', () => ({
  startMediaAnalysis: (options: unknown) => {
    mocks.analysisOptions.push(options);
    return mocks.analysis;
  },
}));
vi.mock('./media/register', () => ({
  registerMediaBackend: (context: MediaBackendRegistration) => {
    mocks.mediaBackendContexts.push(context);
    return mocks.mediaBackendStop;
  },
}));
vi.mock('./import/register', () => ({
  registerTextImport: (context: unknown) => {
    mocks.textImportContexts.push(context);
    return mocks.textImportStop;
  },
}));
vi.mock('./windows/controlClose', () => ({
  registerControlClose: (context: unknown) => {
    mocks.closeContexts.push(context);
    return {confirmClose: mocks.confirmClose, dispose: mocks.closeStop};
  },
}));
vi.mock('./store/uiZoom', () => ({
  registerUiZoom: vi.fn(() => {
    mocks.order.push('UI zoom');
    return mocks.zoom;
  }),
}));
vi.mock('./uiState/register', () => ({
  registerUiState: vi.fn(() => {
    mocks.order.push('ui state');
    return {dispose: mocks.uiDispose};
  }),
}));
vi.mock('./soak', () => ({
  deferSoakScenario: (_ready: Promise<unknown>, start: () => () => void) =>
    start(),
  prepareSoakGarbageCollection: () => undefined,
  registerSoakRecorder: (_log: unknown, sources: unknown) => {
    mocks.soakSources.push(sources);
    return mocks.soakStop;
  },
  registerSoakScenario: (
    _log: unknown,
    dispatch: (command: LiveCommand) => void,
  ) => {
    mocks.scenarioDispatch.current = dispatch;
    return mocks.scenarioStop;
  },
}));
vi.mock('./store/appConfigFile', () => ({
  openAppConfig: vi.fn(async () => {
    mocks.order.push('app.json');
    return mocks.appConfig;
  }),
}));
vi.mock('./store/register', () => ({
  registerStore: (options: unknown) => {
    mocks.order.push('data store');
    mocks.storeOptions.push(options);
    return {
      bible: mocks.bible,
      content: Promise.resolve(null),
      settings: mocks.settings,
      selectLook: mocks.selectLook,
      dispose: mocks.storeDispose,
      findMediaFile: mocks.findMediaFile,
      mediaRoots: mocks.mediaRoots,
    };
  },
}));
vi.mock('./ipc', () => ({registerIpc: () => () => undefined}));
vi.mock('./problemFeed', () => ({
  registerProblemFeed: (context: unknown) => {
    mocks.problemContexts.push(context);
    return {feed: mocks.problemFeed, dispose: mocks.problemsStop};
  },
}));
vi.mock('./outputs/start', () => ({
  startOutputs: (context: {readonly store: LiveStore}) => {
    mocks.outputContexts.push(context);
    return {stop: mocks.outputsStop, frameRates: mocks.frameRates};
  },
}));
vi.mock('./windows/mediaProtocol', () => ({
  registerMediaScheme: () => undefined,
  serveMedia: (options: MediaHandlerOptions) => {
    mocks.mediaOptions.push(options);
    return () => undefined;
  },
}));
vi.mock('./windows/control', () => ({
  createControlWindow: (_log: unknown, _mode: unknown, zoom: unknown) => {
    mocks.zoomForControl.push(zoom);
    mocks.order.push('control window');
    const win = Object.assign(new EventEmitter(), mocks.controlWindow);
    mocks.opened.control = win;
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
  await vi.waitFor(() => expect(mocks.opened.control).not.toBeNull());
  const control = mocks.opened.control;
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
  mocks.screensWindowContexts.length = 0;
  mocks.screensWindowStop.mockClear();
  mocks.screensWindowClose.mockReset().mockResolvedValue(true);
  mocks.electron.app.getPath.mockReturnValue(await makeTempDir());
  mocks.electron.app.quit.mockReset();
  mocks.electron.app.releaseSingleInstanceLock.mockClear();
  mocks.electron.app.isPackaged = true;
  mocks.controlWindow.restore.mockClear();
  mocks.controlWindow.focus.mockClear();
  mocks.order.length = 0;
  mocks.overlayContexts.length = 0;
  mocks.audioContexts.length = 0;
  mocks.audioStop.mockReset();
  mocks.lookSelectionContexts.length = 0;
  mocks.lookSelectionStop.mockReset();
  mocks.themeOutputContexts.length = 0;
  mocks.themeOutputStop.mockReset();
  mocks.selectLook.mockReset();
  mocks.recovery.crashed = false;
  mocks.recovery.markQuitting.mockReset();
  mocks.recovery.cleanExit.mockReset();
  mocks.recordOptions.length = 0;
  mocks.writers.length = 0;
  mocks.recoveryOptions.length = 0;
  mocks.recoveryStart.mockReset().mockResolvedValue(undefined);
  mocks.recoveryPorts.length = 0;
  mocks.recoveryChannelsStop.mockReset();
  mocks.macrosStartFresh.mockReset();
  mocks.recordStart.mockReset();
  mocks.recordStop.mockReset();
  mocks.recordSettled.mockReset();
  mocks.macroContexts.length = 0;
  mocks.macrosStop.mockReset();
  mocks.overlaysStop.mockReset();
  mocks.textImportContexts.length = 0;
  mocks.textImportStop.mockReset();
  mocks.bibleContexts.length = 0;
  mocks.bibleStop.mockReset();
  mocks.fontContexts.length = 0;
  mocks.fontsStop.mockReset();
  mocks.mediaBackendContexts.length = 0;
  mocks.mediaBackendStop.mockReset();
  mocks.analysisOptions.length = 0;
  mocks.analysis.dispose.mockReset();
  mocks.closeContexts.length = 0;
  mocks.confirmClose.mockReset().mockResolvedValue(true);
  mocks.closeStop.mockReset();
  mocks.problemContexts.length = 0;
  mocks.problemsStop.mockReset();
  mocks.appHandlers.clear();
  mocks.opened.control = null;
  mocks.uiDispose.mockReset();
  mocks.zoom.attachControl.mockReset();
  mocks.zoom.dispose.mockReset();
  mocks.zoomForControl.length = 0;
  mocks.soakStop.mockReset();
  mocks.soakSources.length = 0;
  mocks.scenarioStop.mockReset();
  mocks.scenarioDispatch.current = null;
  mocks.outputsStop.mockReset();
  mocks.outputContexts.length = 0;
  mocks.storeDispose.mockReset();
  mocks.appConfig.flush.mockReset();
  mocks.storeOptions.length = 0;
  mocks.mediaOptions.length = 0;
});

function launchAgain(): void {
  for (const handler of mocks.appHandlers.get('second-instance') ?? []) {
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
  for (const handler of mocks.appHandlers.get('before-quit') ?? []) {
    handler(event);
  }
  return event;
}

describe('main entry wiring', {timeout: ENTRY_TEST_TIMEOUT_MS}, () => {
  it('registers fonts for the control window and stops enumeration before closing data', async () => {
    const control = await startMain();
    expect(mocks.fontContexts).toHaveLength(1);
    expect(mocks.fontContexts[0]).toHaveProperty('control', control);
    expect(mocks.fontContexts[0]).toHaveProperty('log.warn');
    beforeQuit();
    await vi.waitFor(() => expect(mocks.storeDispose).toHaveBeenCalledOnce());
    expect(mocks.fontsStop).toHaveBeenCalledOnce();
    expect(mocks.fontsStop.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.storeDispose.mock.invocationCallOrder[0] ?? Infinity,
    );
  });

  it('connects Bible IPC to the data store reader and stops IPC before closing data', async () => {
    await startMain();
    expect(mocks.bibleContexts).toEqual([
      expect.objectContaining({
        session: mocks.bible,
      }),
    ]);
    expect(mocks.bibleContexts[0]).toHaveProperty('log');
    beforeQuit();
    await vi.waitFor(() => expect(mocks.storeDispose).toHaveBeenCalledOnce());
    expect(mocks.bibleStop).toHaveBeenCalledOnce();
    expect(mocks.bibleStop.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.storeDispose.mock.invocationCallOrder[0] ?? Infinity,
    );
  });
  it('starts a crashed session in standby and removes its marker after saving the data store', async () => {
    const finish = deferred();
    onTestFinished(finish.resolve);
    mocks.recovery.cleanExit.mockReturnValue(finish.promise);
    mocks.recovery.crashed = true;
    await startMain();
    expect(mocks.outputContexts[0]?.store.state.outputs).toEqual({});
    expect(mocks.macroContexts).toEqual([
      expect.objectContaining({launch: 'restore'}),
    ]);
    beforeQuit();
    await vi.waitFor(() =>
      expect(mocks.recovery.cleanExit).toHaveBeenCalledOnce(),
    );
    expect(mocks.storeDispose.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.recovery.cleanExit.mock.invocationCallOrder[0] ?? Infinity,
    );
    expect(mocks.electron.app.releaseSingleInstanceLock).not.toHaveBeenCalled();
    expect(mocks.electron.app.quit).not.toHaveBeenCalled();
    finish.resolve();
    await vi.waitFor(() =>
      expect(mocks.electron.app.quit).toHaveBeenCalledOnce(),
    );
  });
  it('leaves a crashed launch, its record, and the held-back startup macros to recovery', async () => {
    mocks.recovery.crashed = true;
    await startMain();
    const userData = mocks.electron.app.getPath('userData');
    const file = join(userData, 'recovery', 'live.json');
    const store = mocks.outputContexts[0]?.store;
    expect(mocks.recordOptions).toMatchObject([{file, store}]);
    expect(mocks.recoveryOptions).toMatchObject([
      {
        crashed: true,
        file,
        store,
        record: mocks.writers[0],
        runStartupMacros: mocks.macrosStartFresh,
      },
    ]);
    expect(mocks.recoveryPorts).toHaveLength(1);
    expect(mocks.recoveryStart).toHaveBeenCalledOnce();
    expect(mocks.recordStart).not.toHaveBeenCalled();
  });

  it('starts recovery on a normal launch and marks quitting before anything else stops', async () => {
    const lastWrite = deferred();
    onTestFinished(lastWrite.resolve);
    mocks.recordSettled.mockReturnValue(lastWrite.promise);
    await startMain();
    expect(mocks.recoveryOptions).toMatchObject([{crashed: false}]);
    expect(mocks.recoveryStart).toHaveBeenCalledOnce();
    beforeQuit();
    await vi.waitFor(() => expect(mocks.recordSettled).toHaveBeenCalledOnce());
    const order = [
      mocks.recovery.markQuitting,
      mocks.recordStop,
      mocks.scenarioStop,
      mocks.outputsStop,
      mocks.appConfig.flush,
      mocks.storeDispose,
      mocks.recoveryChannelsStop,
      mocks.recordSettled,
    ].map(step => step.mock.invocationCallOrder[0] ?? Infinity);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(order.every(Number.isFinite)).toBe(true);
    expect(mocks.recovery.cleanExit).not.toHaveBeenCalled();
    lastWrite.resolve();
    await vi.waitFor(() =>
      expect(mocks.recovery.cleanExit).toHaveBeenCalledOnce(),
    );
  });

  it('connects macro execution to the shared live and data stores and stops it before closing data', async () => {
    await startMain();
    expect(mocks.macroContexts[0]).toHaveProperty('launch', 'normal');
    expect(mocks.macroContexts).toHaveLength(1);
    expect(mocks.macroContexts[0]).toHaveProperty(
      'store',
      mocks.outputContexts[0]?.store,
    );
    expect(mocks.macroContexts[0]).toHaveProperty(
      'data.settings',
      mocks.settings,
    );
    beforeQuit();
    await vi.waitFor(() => expect(mocks.storeDispose).toHaveBeenCalledOnce());
    expect(mocks.macrosStop).toHaveBeenCalledOnce();
    expect(mocks.macrosStop.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.storeDispose.mock.invocationCallOrder[0] ?? Infinity,
    );
  });
  it('starts independent audio output and releases it before the data store', async () => {
    await startMain();
    expect(mocks.audioContexts).toEqual([
      expect.objectContaining({
        store: mocks.outputContexts[0]?.store,
        windowMode: 'normal',
      }),
    ]);
    beforeQuit();
    await vi.waitFor(() => expect(mocks.storeDispose).toHaveBeenCalledOnce());
    expect(mocks.audioStop).toHaveBeenCalledOnce();
    expect(mocks.audioStop.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.storeDispose.mock.invocationCallOrder[0] ?? Infinity,
    );
  });
  it('connects overlay settings to the live store and stops overlays before closing the data store', async () => {
    await startMain();
    expect(mocks.overlayContexts).toEqual([
      expect.objectContaining({
        store: mocks.outputContexts[0]?.store,
        settings: mocks.settings,
      }),
    ]);
    expect(mocks.outputContexts).toEqual([
      expect.objectContaining({settings: mocks.settings}),
    ]);
    beforeQuit();
    await vi.waitFor(() => expect(mocks.storeDispose).toHaveBeenCalledOnce());
    expect(mocks.overlaysStop).toHaveBeenCalledOnce();
    expect(mocks.overlaysStop.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.storeDispose.mock.invocationCallOrder[0] ?? Infinity,
    );
  });

  it('registers text import for the control window and removes its handlers on shutdown', async () => {
    await startMain();
    expect(mocks.textImportContexts).toEqual([
      expect.objectContaining({
        control: mocks.opened.control,
        windowMode: 'normal',
      }),
    ]);
    beforeQuit();
    await vi.waitFor(() => expect(mocks.textImportStop).toHaveBeenCalledOnce());
  });

  it('registers the screens window owner and disposes it before saving app.json', async () => {
    await startMain();
    expect(mocks.screensWindowContexts).toEqual([
      expect.objectContaining({
        control: mocks.opened.control,
        store: mocks.outputContexts[0]?.store,
        config: mocks.appConfig,
        zoom: mocks.zoom,
        mode: 'normal',
      }),
    ]);
    const flushed = deferred();
    mocks.screensWindowClose.mockReturnValueOnce(
      flushed.promise.then(() => true),
    );
    beforeQuit();
    await new Promise(resolve => setImmediate(resolve));
    expect(mocks.confirmClose).not.toHaveBeenCalled();
    expect(mocks.storeDispose).not.toHaveBeenCalled();
    flushed.resolve();
    await vi.waitFor(() => expect(mocks.appConfig.flush).toHaveBeenCalled());
    expect(mocks.screensWindowStop).toHaveBeenCalledOnce();
    expect(mocks.screensWindowStop.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.appConfig.flush.mock.invocationCallOrder.at(-1) ?? -Infinity,
    );
  });

  it('asks the control window to flush before saving and keeps running when it refuses', async () => {
    mocks.confirmClose.mockResolvedValueOnce(false);
    await startMain();
    expect(mocks.closeContexts).toEqual([
      expect.objectContaining({control: mocks.opened.control}),
    ]);
    expect(beforeQuit().prevented).toBe(true);
    await vi.waitFor(() => expect(mocks.confirmClose).toHaveBeenCalledOnce());
    await new Promise(resolve => setImmediate(resolve));
    expect(mocks.scenarioStop).not.toHaveBeenCalled();
    expect(mocks.uiDispose).not.toHaveBeenCalled();
    expect(mocks.electron.app.quit).not.toHaveBeenCalled();
    expect(beforeQuit().prevented).toBe(true);
    await vi.waitFor(() =>
      expect(mocks.electron.app.quit).toHaveBeenCalledOnce(),
    );
    expect(mocks.confirmClose).toHaveBeenCalledTimes(2);
    expect(mocks.confirmClose.mock.invocationCallOrder[1]).toBeLessThan(
      mocks.scenarioStop.mock.invocationCallOrder[0] ?? -Infinity,
    );
    expect(mocks.closeStop).toHaveBeenCalledOnce();
    expect(mocks.storeDispose.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.closeStop.mock.invocationCallOrder[0] ?? -Infinity,
    );
  });

  it('reports the live store problems to the windows and stops on shutdown', async () => {
    await startMain();
    expect(mocks.problemContexts).toEqual([
      expect.objectContaining({store: mocks.outputContexts[0]?.store}),
    ]);
    expect(mocks.storeOptions[0]).toHaveProperty('problems', mocks.problemFeed);
    beforeQuit();
    await vi.waitFor(() =>
      expect(mocks.electron.app.quit).toHaveBeenCalledOnce(),
    );
    expect(mocks.problemsStop).toHaveBeenCalledOnce();
  });

  it('connects the media backend to the data store and the control window and stops it before closing data', async () => {
    await startMain();
    expect(mocks.mediaBackendContexts).toEqual([
      expect.objectContaining({
        control: mocks.opened.control,
        windowMode: 'normal',
      }),
    ]);
    beforeQuit();
    await vi.waitFor(() => expect(mocks.storeDispose).toHaveBeenCalledOnce());
    expect(mocks.mediaBackendStop).toHaveBeenCalledOnce();
    expect(mocks.mediaBackendStop.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.storeDispose.mock.invocationCallOrder[0] ?? -Infinity,
    );
  });

  it('registers Look selection and theme output and releases both before closing data', async () => {
    await startMain();
    expect(mocks.lookSelectionContexts).toMatchObject([
      {
        store: mocks.outputContexts[0]?.store,
        selection: {selectLook: mocks.selectLook},
      },
    ]);
    expect(mocks.themeOutputContexts).toMatchObject([
      {store: mocks.outputContexts[0]?.store},
    ]);
    beforeQuit();
    await vi.waitFor(() => expect(mocks.storeDispose).toHaveBeenCalledOnce());
    expect(mocks.lookSelectionStop).toHaveBeenCalledOnce();
    expect(mocks.themeOutputStop).toHaveBeenCalledOnce();
    expect(mocks.themeOutputStop.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.storeDispose.mock.invocationCallOrder[0] ?? Infinity,
    );
    expect(mocks.lookSelectionStop.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.storeDispose.mock.invocationCallOrder[0] ?? Infinity,
    );
  });

  it('reads the UI state before the control window opens', async () => {
    await startMain();
    expect(mocks.order).toEqual([
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
    expect(mocks.zoomForControl).toEqual([mocks.zoom]);
    beforeQuit();
    await vi.waitFor(() => expect(mocks.appConfig.flush).toHaveBeenCalled());
    expect(mocks.zoom.dispose).toHaveBeenCalledOnce();
    expect(mocks.zoom.dispose.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.appConfig.flush.mock.invocationCallOrder[0] ?? Infinity,
    );
  });

  it('tells the data store whether an output is on', async () => {
    await startMain();

    expect(mocks.storeOptions).toHaveLength(1);
    expect(mocks.storeOptions[0]).toHaveProperty('log');
    expect(mocks.storeOptions[0]).toHaveProperty('isAnyOutputOn');
  });

  it('gives the data store the app.json it opened first', async () => {
    await startMain();

    expect(mocks.storeOptions[0]).toHaveProperty('appConfig', mocks.appConfig);
  });

  it('saves app.json on quit, after the UI state', async () => {
    const ui = deferred();
    mocks.uiDispose.mockReturnValue(ui.promise);
    mocks.soakStop.mockResolvedValue(undefined);
    await startMain();

    beforeQuit();
    await new Promise(resolve => setImmediate(resolve));
    expect(mocks.appConfig.flush).not.toHaveBeenCalled();
    ui.resolve();

    await vi.waitFor(() => {
      expect(mocks.appConfig.flush).toHaveBeenCalledTimes(1);
    });
  });

  it('serves media through the data store lookup', async () => {
    await startMain();

    expect(mocks.mediaOptions).toHaveLength(1);
    expect(mocks.mediaOptions[0]).toHaveProperty(
      'resolvePath',
      mocks.findMediaFile,
    );
    expect(mocks.mediaOptions[0]).toHaveProperty(
      'mediaRoots',
      mocks.mediaRoots,
    );
  });

  it('shares media analysis with the media scheme and the backend, and stops it after the backend', async () => {
    await startMain();
    expect(mocks.analysisOptions).toMatchObject([
      {
        thumbnailFolder: join(
          mocks.electron.app.getPath('userData'),
          'cache',
          'thumbnails',
        ),
      },
    ]);
    expect(mocks.mediaBackendContexts[0]?.analysis).toBe(mocks.analysis);
    expect(mocks.mediaBackendContexts[0]?.uiState).toBe(mocks.appConfig);
    expect(mocks.mediaOptions[0]?.analysisFile?.('token')).toBe('a.mp4');
    expect(await mocks.mediaOptions[0]?.thumbnail?.('id')).toBe('thumb.jpg');
    beforeQuit();
    await vi.waitFor(() =>
      expect(mocks.analysis.dispose).toHaveBeenCalledOnce(),
    );
    expect(mocks.mediaBackendStop.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.analysis.dispose.mock.invocationCallOrder[0] ?? -Infinity,
    );
  });

  it('asks to quit when the control window closes', async () => {
    const control = await startMain();
    control.emit('closed');
    expect(mocks.electron.app.quit).toHaveBeenCalledTimes(1);
  });

  it('holds the quit until the UI state and the soak record are written', async () => {
    const ui = deferred();
    const soak = deferred();
    mocks.uiDispose.mockReturnValue(ui.promise);
    mocks.soakStop.mockReturnValue(soak.promise);
    await startMain();
    expect(beforeQuit().prevented).toBe(true);
    expect(beforeQuit().prevented).toBe(true);
    ui.resolve();
    await ui.promise;
    await new Promise(resolve => setImmediate(resolve));
    expect(mocks.electron.app.quit).not.toHaveBeenCalled();
    soak.resolve();
    await vi.waitFor(() => {
      expect(mocks.electron.app.quit).toHaveBeenCalledTimes(1);
    });
    expect(mocks.uiDispose).toHaveBeenCalledTimes(1);
    expect(mocks.storeDispose).toHaveBeenCalledTimes(1);
    expect(mocks.electron.app.releaseSingleInstanceLock).toHaveBeenCalled();
    expect(beforeQuit().prevented).toBe(false);
  });

  it('still quits when saving fails', async () => {
    mocks.uiDispose.mockRejectedValue(new Error('disk full'));
    mocks.soakStop.mockResolvedValue(undefined);
    await startMain();
    beforeQuit();
    await vi.waitFor(() => {
      expect(mocks.electron.app.quit).toHaveBeenCalled();
    });
  });

  it('restores and focuses the control window on a second launch', async () => {
    await startMain();

    launchAgain();

    expect(mocks.controlWindow.restore).toHaveBeenCalledTimes(1);
    expect(mocks.controlWindow.focus).toHaveBeenCalledTimes(1);
  });

  it('keeps an offscreen control window hidden on a second launch', async () => {
    mocks.electron.app.isPackaged = false;
    vi.stubEnv('LLP_TEST_WINDOWS', 'offscreen');
    await startMain();

    launchAgain();

    expect(mocks.controlWindow.restore).not.toHaveBeenCalled();
    expect(mocks.controlWindow.focus).not.toHaveBeenCalled();
  });

  it("gives the soak recorder the outputs' frame rates", async () => {
    await startMain();

    expect(mocks.soakSources).toEqual([{frameRates: mocks.frameRates}]);
  });

  it('lets the soak scenario change the live state', async () => {
    await startMain();
    const store = mocks.outputContexts[0]?.store;

    mocks.scenarioDispatch.current?.({
      type: 'output.set',
      screenId: 'main',
      on: true,
    });

    expect(store?.state.outputs).toEqual({main: true});
  });

  it('stops the soak scenario before the outputs when quitting', async () => {
    const stopped: string[] = [];
    mocks.scenarioStop.mockImplementation(() => {
      stopped.push('soak scenario');
    });
    mocks.outputsStop.mockImplementation(() => {
      stopped.push('outputs');
    });
    mocks.uiDispose.mockResolvedValue(undefined);
    mocks.soakStop.mockResolvedValue(undefined);
    mocks.storeDispose.mockResolvedValue(undefined);
    await startMain();

    beforeQuit();

    await vi.waitFor(() => {
      expect(mocks.electron.app.quit).toHaveBeenCalled();
    });
    expect(stopped).toEqual(['soak scenario', 'outputs']);
  });

  it('quits when the last window closes, through the same shutdown', async () => {
    await startMain();
    for (const handler of mocks.appHandlers.get('window-all-closed') ?? []) {
      handler();
    }
    expect(mocks.electron.app.quit).toHaveBeenCalledTimes(1);
  });
});
