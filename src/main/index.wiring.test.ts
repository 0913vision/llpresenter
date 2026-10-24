import {EventEmitter} from 'node:events';
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
    soakStop: vi.fn<() => Promise<void>>(),
    soakSources,
    scenarioStop: vi.fn<() => void>(),
    scenarioDispatch,
    outputsStop: vi.fn<() => void>(),
    outputContexts,
    frameRates: vi.fn<() => readonly unknown[]>(() => []),
    storeDispose: vi.fn<() => Promise<void>>(),
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
vi.mock('./uiState/register', () => ({
  registerUiState: vi.fn(async () => {
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
vi.mock('./store/register', () => ({
  registerStore: (options: unknown) => {
    fakes.order.push('data store');
    fakes.storeOptions.push(options);
    return {
      dispose: fakes.storeDispose,
      findMediaFile: fakes.findMediaFile,
      mediaRoots: fakes.mediaRoots,
    };
  },
}));
vi.mock('./ipc', () => ({registerIpc: () => () => undefined}));
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
  createControlWindow: () => {
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
  fakes.appHandlers.clear();
  fakes.opened.control = null;
  fakes.uiDispose.mockReset();
  fakes.soakStop.mockReset();
  fakes.soakSources.length = 0;
  fakes.scenarioStop.mockReset();
  fakes.scenarioDispatch.current = null;
  fakes.outputsStop.mockReset();
  fakes.outputContexts.length = 0;
  fakes.storeDispose.mockReset();
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
  it('reads the UI state before the control window opens', async () => {
    await startMain();
    expect(fakes.order).toEqual(['ui state', 'data store', 'control window']);
  });

  it('tells the data store whether an output is on', async () => {
    await startMain();

    expect(fakes.storeOptions).toHaveLength(1);
    expect(fakes.storeOptions[0]).toHaveProperty('log');
    expect(fakes.storeOptions[0]).toHaveProperty('isAnyOutputOn');
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
