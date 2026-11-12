// NOTE(0913vision): The test files import this module first, because its
// vi.mock calls only reach modules that load after it.
import {beforeEach, expect, onTestFinished, vi} from 'vitest';
import type {Rect} from '@main/displays/rect';
import type {Logger} from '@main/log';
import type {WindowMode} from '@main/windows/testWindows';
import {createElectronOutputWindow} from '@main/outputs/electronWindow';
import type {OutputWindowHandle} from '@main/outputs/outputWindow';
import type {OutputScreen} from '@main/outputs/screens';

const electron = await vi.hoisted(async () => {
  const {EventEmitter} = await import('node:events');
  class MockBrowserWindow extends EventEmitter {
    readonly webContents = Object.assign(new EventEmitter(), {
      isCrashed: vi.fn(() => false),
      executeJavaScript: vi.fn(() => Promise.resolve(0)),
      forcefullyCrashRenderer: vi.fn(),
      capturePage: vi.fn(() => Promise.resolve()),
    });
    readonly setContentBounds = vi.fn<(bounds: Rect) => void>();
    readonly setTitle = vi.fn();
    readonly setBounds = vi.fn<(bounds: Rect) => void>();
    readonly getBounds = vi.fn(() => ({x: 0, y: 0, width: 800, height: 600}));
    readonly getContentBounds = vi.fn(() => ({
      x: 0,
      y: 0,
      width: 800,
      height: 600,
    }));
    readonly getMediaSourceId = vi.fn(() => 'window:42:0');
    readonly setFullScreen = vi.fn();
    readonly isFullScreen = vi.fn(() => false);
    readonly setFocusable = vi.fn();
    readonly setMinimizable = vi.fn();
    readonly setMaximizable = vi.fn();
    readonly setResizable = vi.fn();
    readonly setAspectRatio = vi.fn();
    readonly setBackgroundColor = vi.fn();
    onTop = false;
    readonly setAlwaysOnTop = vi.fn<(flag: boolean) => void>(flag => {
      this.onTop = flag;
    });
    readonly isAlwaysOnTop = vi.fn(() => this.onTop);
    visible = false;
    readonly isVisible = vi.fn(() => this.visible);
    readonly showInactive = vi.fn(() => {
      this.visible = true;
    });
    readonly show = vi.fn();
    readonly focus = vi.fn();
    readonly moveTop = vi.fn();
    readonly isMinimized = vi.fn(() => false);
    readonly hide = vi.fn(() => {
      this.visible = false;
    });
    readonly removeMenu = vi.fn();
    readonly isDestroyed = vi.fn(() => false);
    readonly destroy = vi.fn();

    constructor(readonly options: unknown) {
      super();
      created.push(this);
    }
  }
  const created: MockBrowserWindow[] = [];
  const getDisplayMatching = vi.fn((bounds: Rect) => ({workArea: bounds}));
  return {MockBrowserWindow, created, getDisplayMatching};
});

vi.mock('electron', () => ({
  BrowserWindow: electron.MockBrowserWindow,
  screen: {getDisplayMatching: electron.getDisplayMatching},
}));
vi.mock('@main/windows/page', () => ({
  preloadPath: 'preload.js',
  loadPage: vi.fn(),
  startLoading: vi.fn(() => Promise.resolve()),
  blockNavigation: vi.fn(),
}));

export const MONITOR: Rect = {x: 1920, y: 0, width: 1920, height: 1080};
export const WINDOW_BOUNDS: Rect = {x: 100, y: 100, width: 960, height: 540};

export const SCREEN: OutputScreen = {
  id: 'main',
  name: '청중 화면',
  method: 'fullscreen',
  display: null,
  onDisconnect: 'window',
  alwaysOnTop: true,
};

export function mockLog() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    flush: () => Promise.resolve(),
  } satisfies Logger;
}

export function mockControl() {
  return {
    isDestroyed: vi.fn(() => false),
    moveAbove: vi.fn<(mediaSourceId: string) => void>(),
    focus: vi.fn(),
    webContents: {
      isDestroyed: vi.fn(() => false),
      executeJavaScript: vi.fn<(script: string) => Promise<void>>(() =>
        Promise.resolve(),
      ),
    },
  };
}

export function openOutput(
  mode: WindowMode,
  control = mockControl(),
  log = mockLog(),
): OutputWindowHandle {
  const output = createElectronOutputWindow(
    SCREEN,
    {onRendererGone: vi.fn(), onCloseRequested: vi.fn()},
    {log, mode, control},
  );
  onTestFinished(() => output.destroy());
  return output;
}

export function lastWindow(): InstanceType<typeof electron.MockBrowserWindow> {
  const win = electron.created.at(-1);
  if (win === undefined) throw new Error('no window was created');
  return win;
}
export function expectNeverPresented(
  win: InstanceType<typeof electron.MockBrowserWindow>,
): void {
  expect(win.showInactive).not.toHaveBeenCalled();
  expect(win.show).not.toHaveBeenCalled();
  expect(win.focus).not.toHaveBeenCalled();
  expect(win.setFullScreen).not.toHaveBeenCalled();
  expect(win.setAlwaysOnTop).not.toHaveBeenCalled();
  expect(win.setFocusable).not.toHaveBeenCalled();
}

beforeEach(() => {
  electron.created.length = 0;
  electron.getDisplayMatching.mockReset();
  electron.getDisplayMatching.mockImplementation(bounds => ({
    workArea: bounds,
  }));
});

export {electron};
