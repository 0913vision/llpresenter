import {EventEmitter} from 'node:events';
import {beforeEach, expect, onTestFinished, vi} from 'vitest';
import type {LiveCommand} from '@core/live/commands';
import {makeTempDir} from '@fixtures/tempDir';
import type {LiveStore} from '@main/live/store';
import type {MediaBackendRegistration} from '@main/media/register';
import type {MediaHandlerOptions} from '@main/windows/mediaResponse';
import type {BibleLookupSession} from '@main/bible/lookup';

// NOTE(0913vision): Each test imports the whole main process afresh, which
// takes several seconds under coverage on a busy machine.
export const ENTRY_TEST_TIMEOUT_MS = 30_000;

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
    themeOutputContexts: new Array<unknown>(),
    themeOutputStop: vi.fn<() => void>(),
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
    orderEditorWindowClose: vi.fn<() => Promise<boolean>>(() =>
      Promise.resolve(true),
    ),
    editorWindowContexts: new Array<{
      readonly name: string;
      readonly context: unknown;
    }>(),
    editorWindowStops: {
      order: vi.fn<() => void>(),
      song: vi.fn<() => void>(),
    },
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
vi.mock('@main/windows/screens', () => ({
  registerScreensWindow: (context: unknown) => {
    mocks.screensWindowContexts.push(context);
    return {close: mocks.screensWindowClose, dispose: mocks.screensWindowStop};
  },
}));
vi.mock('@main/windows/preferences', () => ({
  registerPreferencesWindow: () => ({
    close: () => Promise.resolve(true),
    dispose: () => Promise.resolve(),
  }),
}));
vi.mock('@main/windows/orderEditor', () => ({
  registerOrderEditorWindow: (context: unknown) => {
    mocks.editorWindowContexts.push({name: 'order', context});
    return {
      close: mocks.orderEditorWindowClose,
      dispose: mocks.editorWindowStops.order,
    };
  },
}));
vi.mock('@main/windows/songEditor', () => ({
  registerSongEditorWindow: (context: unknown) => {
    mocks.editorWindowContexts.push({name: 'song', context});
    return {dispose: mocks.editorWindowStops.song};
  },
}));
vi.mock('@main/bible/register', () => ({
  registerBible: (context: unknown) => {
    mocks.bibleContexts.push(context);
    return mocks.bibleStop;
  },
}));
vi.mock('@main/fonts/register', () => ({
  registerFonts: (control: unknown, log: unknown) => {
    mocks.fontContexts.push({control, log});
    return mocks.fontsStop;
  },
}));
vi.mock('@main/live/recovery/session', () => ({
  RECOVERY_RECORD_FILE: 'live.json',
  openRecoverySession: () => {
    mocks.order.push('recovery session');
    return Promise.resolve(mocks.recovery);
  },
}));
vi.mock('@main/live/recovery/recordWriter', () => ({
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
vi.mock('@main/live/recovery/controller', () => ({
  recoverySources: () => Promise.resolve(null),
  RecoveryController: class {
    constructor(options: unknown) {
      mocks.recoveryOptions.push(options);
    }
    start = mocks.recoveryStart;
  },
}));
vi.mock('@main/live/recovery/channels', () => ({
  registerRecoveryChannels: (port: unknown) => {
    mocks.recoveryPorts.push(port);
    return mocks.recoveryChannelsStop;
  },
}));
vi.mock('@main/macros/register', () => ({
  registerMacros: (context: unknown) => {
    mocks.macroContexts.push(context);
    return {dispose: mocks.macrosStop, startFresh: mocks.macrosStartFresh};
  },
}));
vi.mock('@main/windows/audio', () => ({
  registerAudioOutput: (context: unknown) => {
    mocks.audioContexts.push(context);
    return mocks.audioStop;
  },
}));
vi.mock('@main/live/overlays', () => ({
  startOverlays: (context: unknown) => {
    mocks.overlayContexts.push(context);
    return mocks.overlaysStop;
  },
}));
vi.mock('@main/live/themes', () => ({
  registerThemeOutput: (context: unknown) => {
    mocks.themeOutputContexts.push(context);
    return mocks.themeOutputStop;
  },
}));
vi.mock('@main/media/analysis', () => ({
  startMediaAnalysis: (options: unknown) => {
    mocks.analysisOptions.push(options);
    return mocks.analysis;
  },
}));
vi.mock('@main/media/register', () => ({
  registerMediaBackend: (context: MediaBackendRegistration) => {
    mocks.mediaBackendContexts.push(context);
    return mocks.mediaBackendStop;
  },
}));
vi.mock('@main/import/register', () => ({
  registerTextImport: (context: unknown) => {
    mocks.textImportContexts.push(context);
    return mocks.textImportStop;
  },
}));
vi.mock('@main/windows/controlClose', () => ({
  registerControlClose: (context: unknown) => {
    mocks.closeContexts.push(context);
    return {confirmClose: mocks.confirmClose, dispose: mocks.closeStop};
  },
}));
vi.mock('@main/store/locationsChannels', () => ({
  registerLibraryLocations: vi.fn(() => () => undefined),
}));
vi.mock('@main/store/uiZoom', () => ({
  registerUiZoom: vi.fn(() => {
    mocks.order.push('UI zoom');
    return mocks.zoom;
  }),
}));
vi.mock('@main/uiState/register', () => ({
  registerUiState: vi.fn(() => {
    mocks.order.push('ui state');
    return {dispose: mocks.uiDispose};
  }),
}));
vi.mock('@main/soak', () => ({
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
vi.mock('@main/store/appConfigFile', () => ({
  openAppConfig: vi.fn(() => {
    mocks.order.push('app.json');
    return Promise.resolve(mocks.appConfig);
  }),
}));
vi.mock('@main/store/register', () => ({
  registerStore: (options: unknown) => {
    mocks.order.push('data store');
    mocks.storeOptions.push(options);
    return {
      bible: mocks.bible,
      content: Promise.resolve(null),
      settings: mocks.settings,
      dispose: mocks.storeDispose,
      findMediaFile: mocks.findMediaFile,
      mediaRoots: mocks.mediaRoots,
    };
  },
}));
vi.mock('@main/ipc', () => ({registerIpc: () => () => undefined}));
vi.mock('@main/problemFeed', () => ({
  registerProblemFeed: (context: unknown) => {
    mocks.problemContexts.push(context);
    return {feed: mocks.problemFeed, dispose: mocks.problemsStop};
  },
}));
vi.mock('@main/outputs/start', () => ({
  startOutputs: (context: {readonly store: LiveStore}) => {
    mocks.outputContexts.push(context);
    return {stop: mocks.outputsStop, frameRates: mocks.frameRates};
  },
}));
vi.mock('@main/windows/mediaProtocol', () => ({
  registerMediaScheme: () => undefined,
  serveMedia: (options: MediaHandlerOptions) => {
    mocks.mediaOptions.push(options);
    return () => undefined;
  },
}));
vi.mock('@main/windows/control', () => ({
  createControlWindow: (_log: unknown, _mode: unknown, zoom: unknown) => {
    mocks.zoomForControl.push(zoom);
    mocks.order.push('control window');
    const win = Object.assign(new EventEmitter(), mocks.controlWindow, {
      webContents: new EventEmitter(),
    });
    mocks.opened.control = win;
    return win;
  },
}));

export async function startMain(): Promise<EventEmitter> {
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
  await import('@main/index');
  await vi.waitFor(() => expect(mocks.opened.control).not.toBeNull());
  const control = mocks.opened.control;
  if (!(control instanceof EventEmitter)) throw new Error('no control window');
  return control;
}

export function deferred(): {promise: Promise<void>; resolve: () => void} {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>(done => {
    resolve = done;
  });
  return {promise, resolve};
}

beforeEach(async () => {
  mocks.screensWindowContexts.length = 0;
  mocks.editorWindowContexts.length = 0;
  mocks.editorWindowStops.order.mockClear();
  mocks.editorWindowStops.song.mockClear();
  mocks.screensWindowStop.mockClear();
  mocks.screensWindowClose.mockReset().mockResolvedValue(true);
  mocks.orderEditorWindowClose.mockReset().mockResolvedValue(true);
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
  mocks.themeOutputContexts.length = 0;
  mocks.themeOutputStop.mockReset();
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

export function launchAgain(): void {
  for (const handler of mocks.appHandlers.get('second-instance') ?? []) {
    handler();
  }
}

export function beforeQuit(): {prevented: boolean} {
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

export {mocks};
