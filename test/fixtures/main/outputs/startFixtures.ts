import {settingsDocument} from '@fixtures/core/settingsDocument';
import type {SettingsReader} from '@core/schema/settingsReader';
import {BrowserWindow} from 'electron';
import {beforeEach, onTestFinished, vi} from 'vitest';
import {outputEndpoints} from '@contracts/ipc/output';
import type {MessageHandler} from '@main/rendererMessages';
import {
  MockDisplaySource,
  displayInfo,
  recordingLogger,
} from '@fixtures/main/displays/testing';
import {LiveStore} from '@main/live/store';
import {startOverlays} from '@main/live/overlays';
import {MAIN, overlaySettings} from '@fixtures/core/overlays';
import type {WindowMode} from '@main/windows/testWindows';
import {mockWindows, type MockWindows} from '@fixtures/main/outputs/testing';
import {startOutputs} from '@main/outputs/start';

const mocks = vi.hoisted(() => {
  const inputs: {
    displays: MockDisplaySource | null;
    windows: MockWindows | null;
  } = {displays: null, windows: null};
  return {
    ...inputs,
    handlers: new Map<string, MessageHandler>(),
    answers: new Map<string, (event?: unknown, value?: unknown) => unknown>(),
    start: vi.fn(() => 7),
    stop: vi.fn(),
    closeNumber: vi.fn(),
    liveVersion: (): number => 0,
  };
});
const control = await vi.hoisted(async () => {
  const {EventEmitter} = await import('node:events');
  class MockContents extends EventEmitter {
    isDestroyed(): boolean {
      return false;
    }
  }
  class MockControl extends EventEmitter {
    readonly webContents = new MockContents();
    isDestroyed(): boolean {
      return false;
    }
    getBounds() {
      return {x: 0, y: 0, width: 1920, height: 1040};
    }
  }
  return {MockControl};
});
vi.mock('electron', () => ({
  BrowserWindow: control.MockControl,
  ipcMain: {
    handle: (
      channel: string,
      handler: (event?: unknown, value?: unknown) => unknown,
    ) => mocks.answers.set(channel, handler),
    removeHandler: (channel: string) => mocks.answers.delete(channel),
  },
  powerSaveBlocker: {
    start: mocks.start,
    stop: mocks.stop,
    isStarted: () => true,
  },
}));
vi.mock('@main/displays/electronSource', () => ({
  createElectronDisplaySource: () => {
    if (mocks.displays === null) throw new Error('Missing displays');
    return mocks.displays;
  },
}));
vi.mock('@main/outputs/electronWindow', () => ({
  createElectronOutputWindow: (...args: Parameters<MockWindows['create']>) => {
    if (mocks.windows === null) throw new Error('Missing windows');
    return mocks.windows.create(...args);
  },
}));
vi.mock('@main/outputs/numberWindow', () => ({
  openNumberWindow: vi.fn(() => ({close: mocks.closeNumber})),
}));
vi.mock('@main/ipc', () => ({
  listenToWindows: (channel: string, handler: MessageHandler) => {
    mocks.handlers.set(channel, handler);
    return () => {
      mocks.handlers.delete(channel);
    };
  },
  answerWindows: (
    channel: string,
    answer: (event?: unknown, value?: unknown) => unknown,
  ) => {
    mocks.answers.set(channel, answer);
    return () => {
      mocks.answers.delete(channel);
    };
  },
  sendToWindows: vi.fn(),
}));

export const STAGE_SCREEN = '00000000-0000-4000-8000-0000000000e3';
export const projector = displayInfo({id: 2, x: 1920});
export const stage = displayInfo({id: 3, x: 3840});
export const savedDisplay = ({
  id,
  name,
  bounds,
  scaleFactor,
}: typeof projector) => ({
  id,
  name,
  bounds,
  scaleFactor,
  number: id,
});
export const main = {
  id: MAIN,
  name: 'Main',
  kind: 'audience',
  method: 'fullscreen',
  display: savedDisplay(projector),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.displays = new MockDisplaySource(
    displayInfo({id: 1, primary: true}),
    projector,
    stage,
  );
  mocks.windows = mockWindows();
  mocks.handlers.clear();
  mocks.answers.clear();
});

export function setup(
  loading?: Promise<SettingsReader | null>,
  windowMode: WindowMode = 'offscreen',
  autoReady = true,
) {
  const settings = overlaySettings();
  settings.update(settingsDocument('screens', {screens: [main]}));
  const store = new LiveStore();
  mocks.liveVersion = () => store.state.version;
  const log = recordingLogger();
  const settingsPromise = loading ?? Promise.resolve(settings.reader);
  const stopOverlays = startOverlays({store, settings: settingsPromise, log});
  const controlWindow = new BrowserWindow({
    show: false,
    webPreferences: {offscreen: true},
  });
  const onPrepared = vi.fn();
  const running = startOutputs({
    store,
    settings: settingsPromise,
    control: controlWindow,
    log,
    windowMode,
    onPrepared,
  });
  const dispatch = store.dispatch.bind(store);
  vi.spyOn(store, 'dispatch').mockImplementation((...args) => {
    const result = dispatch(...args);
    if (!autoReady) return result;
    for (const window of mocks.windows?.created ?? []) {
      mocks.answers.get(outputEndpoints.frameReady.channel)?.(undefined, {
        screenId: window.screen.id,
        version: store.state.version,
        ...window.contentSize(),
        ready: true,
      });
    }
    return result;
  });
  const stop = (): void => {
    running.stop();
    stopOverlays();
  };
  onTestFinished(stop);
  const windows = mocks.windows;
  if (windows === null) throw new Error('Missing windows');
  const save = (screens: readonly object[]): void =>
    settings.update(settingsDocument('screens', {screens}));
  return {
    settings,
    store,
    log,
    running,
    windows,
    save,
    stop,
    stopOverlays,
    controlWindow,
    onPrepared,
  };
}

export async function loaded(autoReady = true) {
  await Promise.resolve();
  await Promise.resolve();
  if (!autoReady) return;
  for (const window of mocks.windows?.created ?? []) {
    mocks.answers.get(outputEndpoints.frameReady.channel)?.(undefined, {
      screenId: window.screen.id,
      version: mocks.liveVersion(),
      ...window.contentSize(),
      ready: true,
    });
  }
}

export {mocks, control};
