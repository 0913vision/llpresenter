import {EventEmitter} from 'node:events';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {Rect} from '../displays/rect';
import type {Logger} from '../log';
import {startLoading} from '../windows/page';
import type {WindowMode} from '../windows/testWindows';
import {createElectronOutputWindow} from './electronWindow';
import type {OutputWindowHandle} from './outputWindow';
import type {OutputScreen} from './screens';

const electron = vi.hoisted(() => {
  class FakeBrowserWindow {
    readonly webContents = Object.assign(new EventEmitter(), {
      isCrashed: vi.fn(() => false),
      executeJavaScript: vi.fn(() => Promise.resolve(0)),
      forcefullyCrashRenderer: vi.fn(),
    });
    readonly setContentBounds = vi.fn();
    readonly setBounds = vi.fn();
    readonly getBounds = vi.fn(() => ({x: 0, y: 0, width: 800, height: 600}));
    readonly setFullScreen = vi.fn();
    readonly isFullScreen = vi.fn(() => false);
    readonly setFocusable = vi.fn();
    readonly setAlwaysOnTop = vi.fn();
    readonly isVisible = vi.fn(() => false);
    readonly showInactive = vi.fn();
    readonly show = vi.fn();
    readonly focus = vi.fn();
    readonly hide = vi.fn();
    readonly removeMenu = vi.fn();
    readonly on = vi.fn();
    readonly isDestroyed = vi.fn(() => false);
    readonly destroy = vi.fn();

    constructor(readonly options: unknown) {
      created.push(this);
    }
  }
  const created: FakeBrowserWindow[] = [];
  return {FakeBrowserWindow, created};
});

vi.mock('electron', () => ({BrowserWindow: electron.FakeBrowserWindow}));
vi.mock('../windows/page', () => ({
  preloadPath: 'preload.js',
  loadPage: vi.fn(),
  startLoading: vi.fn(() => Promise.resolve()),
  blockNavigation: vi.fn(),
}));

const MONITOR: Rect = {x: 1920, y: 0, width: 1920, height: 1080};
const WINDOW_BOUNDS: Rect = {x: 100, y: 100, width: 960, height: 540};

const SCREEN: OutputScreen = {
  id: 'main',
  name: '본 화면',
  method: 'fullscreen',
  display: null,
  onDisconnect: 'window',
  alwaysOnTop: true,
};

function fakeLog() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    flush: () => Promise.resolve(),
  } satisfies Logger;
}

function openOutput(mode: WindowMode): OutputWindowHandle {
  return createElectronOutputWindow(
    SCREEN,
    {onRendererGone: vi.fn(), onCloseRequested: vi.fn()},
    {log: fakeLog(), mode},
  );
}

function lastWindow(): InstanceType<typeof electron.FakeBrowserWindow> {
  const win = electron.created.at(-1);
  if (win === undefined) throw new Error('no window was created');
  return win;
}

function expectNeverPresented(
  win: InstanceType<typeof electron.FakeBrowserWindow>,
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
});

describe('createElectronOutputWindow offscreen', () => {
  it('opens hidden, out of the taskbar, and drawn in memory at full rate', () => {
    openOutput('offscreen');

    expect(lastWindow().options).toMatchObject({
      show: false,
      skipTaskbar: true,
      webPreferences: {
        offscreen: {useSharedTexture: true},
        backgroundThrottling: false,
      },
    });
  });

  it('releases every offscreen frame before receiving the next one', async () => {
    const output = openOutput('offscreen');
    const contents = lastWindow().webContents;
    const release = vi.fn();

    for (let frame = 0; frame < 3; frame += 1) {
      contents.emit('paint', {texture: {release}});
      expect(release).toHaveBeenCalledTimes(frame + 1);
    }
    await output.reload();
    contents.emit('paint', {texture: {release}});
    expect(release).toHaveBeenCalledTimes(4);

    contents.emit('destroyed');
    expect(contents.listenerCount('paint')).toBe(0);
  });

  it('gives a full screen output the size of its monitor without showing it', () => {
    const output = openOutput('offscreen');
    const win = lastWindow();

    output.showFullScreen(MONITOR, true);

    expect(win.setContentBounds).toHaveBeenCalledWith(MONITOR);
    expectNeverPresented(win);
  });

  it('gives a windowed output its window bounds without showing it', () => {
    const output = openOutput('offscreen');
    const win = lastWindow();

    output.showWindowed(WINDOW_BOUNDS);

    expect(win.setBounds).toHaveBeenCalledWith(WINDOW_BOUNDS);
    expectNeverPresented(win);
  });

  it('keeps the size of a windowed output when no bounds are given', () => {
    const output = openOutput('offscreen');
    const win = lastWindow();

    output.showWindowed(null);

    expect(win.setBounds).not.toHaveBeenCalled();
    expectNeverPresented(win);
  });

  it('leaves a hidden output as it is when hidden again', () => {
    const output = openOutput('offscreen');

    output.hide();

    expect(lastWindow().hide).not.toHaveBeenCalled();
  });
});

describe('createElectronOutputWindow hang handling', () => {
  it('pings the page by running a script on its main thread', async () => {
    const output = openOutput('normal');

    await expect(output.ping()).resolves.toBeUndefined();
    expect(lastWindow().webContents.executeJavaScript).toHaveBeenCalledTimes(1);
  });

  it('passes a failed ping on as a rejection', async () => {
    const output = openOutput('normal');
    lastWindow().webContents.executeJavaScript.mockRejectedValueOnce(
      new Error('Object has been destroyed'),
    );

    await expect(output.ping()).rejects.toThrow('Object has been destroyed');
  });

  it('crashes the renderer only while the window exists', () => {
    const output = openOutput('normal');
    const win = lastWindow();

    output.crashRenderer();
    win.isDestroyed.mockReturnValue(true);
    output.crashRenderer();

    expect(win.webContents.forcefullyCrashRenderer).toHaveBeenCalledTimes(1);
  });
});

describe('createElectronOutputWindow reload', () => {
  it('rejects when the page fails to load, so the recovery hears of it', async () => {
    const output = openOutput('normal');
    vi.mocked(startLoading).mockRejectedValueOnce(new Error('ERR_FAILED'));

    await expect(output.reload()).rejects.toThrow('ERR_FAILED');
  });
});

describe('createElectronOutputWindow normal', () => {
  it('shows a full screen output on its monitor without taking focus', () => {
    const output = openOutput('normal');
    const win = lastWindow();

    output.showFullScreen(MONITOR, true);

    expect(win.setFocusable).toHaveBeenCalledWith(false);
    expect(win.setFullScreen).toHaveBeenCalledWith(true);
    expect(win.setAlwaysOnTop).toHaveBeenCalledWith(true);
    expect(win.showInactive).toHaveBeenCalledTimes(1);
    expect(win.focus).not.toHaveBeenCalled();
  });

  it('shows a windowed output at its bounds without taking focus', () => {
    const output = openOutput('normal');
    const win = lastWindow();

    output.showWindowed(WINDOW_BOUNDS);

    expect(win.setBounds).toHaveBeenCalledWith(WINDOW_BOUNDS);
    expect(win.setAlwaysOnTop).toHaveBeenCalledWith(false);
    expect(win.showInactive).toHaveBeenCalledTimes(1);
    expect(win.focus).not.toHaveBeenCalled();
  });

  it('hides the window', () => {
    const output = openOutput('normal');

    output.hide();

    expect(lastWindow().hide).toHaveBeenCalledTimes(1);
  });

  it('opens hidden with the normal window options', () => {
    openOutput('normal');

    expect(lastWindow().options).toMatchObject({
      show: false,
      focusable: false,
      webPreferences: {backgroundThrottling: false},
    });
    expect(lastWindow().options).not.toHaveProperty('skipTaskbar');
    expect(lastWindow().options).not.toHaveProperty('webPreferences.offscreen');
    expect(lastWindow().webContents.listenerCount('paint')).toBe(0);
  });
});
