import {BrowserWindow} from 'electron';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {AppConfig} from '@core/schema/appConfig';
import {windowEndpoints} from '@contracts/ipc/window';
import {recordingLogger} from '../displays/testing';
import {registerScreensWindow} from './screens';
import {loadPage} from './page';

const mocks = await vi.hoisted(async () => {
  const {EventEmitter} = await import('node:events');
  class MockWindow extends EventEmitter {
    destroyed = false;
    readonly webContents = Object.assign(new EventEmitter(), {
      setAudioMuted: vi.fn(),
    });
    readonly show = vi.fn();
    readonly focus = vi.fn();
    readonly restore = vi.fn();
    readonly maximize = vi.fn();
    readonly removeMenu = vi.fn();
    readonly isMinimized = vi.fn(() => true);
    readonly isMaximized = vi.fn(() => false);
    readonly getNormalBounds = vi.fn(() => ({
      x: 100,
      y: 80,
      width: 1400,
      height: 800,
    }));
    isDestroyed = () => this.destroyed;
    destroy = vi.fn(() => {
      this.destroyed = true;
      this.webContents.emit('destroyed');
      this.emit('closed');
    });
    constructor(readonly options: unknown) {
      super();
      created.push(this);
    }
  }
  const created: MockWindow[] = [];
  return {MockWindow, created, ipc: new EventEmitter()};
});

vi.mock('electron', () => ({
  BrowserWindow: mocks.MockWindow,
  ipcMain: mocks.ipc,
  screen: {
    getPrimaryDisplay: () => ({
      workArea: {x: 0, y: 0, width: 1920, height: 1080},
    }),
    getDisplayMatching: () => ({
      workArea: {x: 0, y: 0, width: 1920, height: 1080},
    }),
  },
}));
vi.mock('./page', () => ({
  preloadPath: 'preload.js',
  loadPage: vi.fn(),
  blockNavigation: vi.fn(),
}));

beforeEach(() => {
  mocks.created.length = 0;
  mocks.ipc.removeAllListeners();
  vi.mocked(loadPage).mockClear();
});

function setup(
  mode: 'normal' | 'offscreen' = 'normal',
  placement?: AppConfig['screensWindow'],
) {
  const control = new BrowserWindow();
  const config = {screensWindow: placement, setScreensWindow: vi.fn()};
  const zoom = {attachControl: vi.fn()};
  const stop = registerScreensWindow({
    control,
    config,
    zoom,
    mode,
    log: recordingLogger(),
  });
  const open = () => mocks.ipc.emit(windowEndpoints.openScreens.channel);
  const last = () => {
    const win = mocks.created.at(-1);
    if (win === undefined || mocks.created.length < 2) {
      throw new Error('Missing screens window');
    }
    return win;
  };
  return {control, config, zoom, stop, open, last};
}

describe('screen configuration window', () => {
  it('opens once, restores and focuses on repeat, and opens afresh after close', () => {
    const {open, last, stop, zoom} = setup();
    open();
    const first = last();
    expect(first.options).toMatchObject({
      show: false,
      frame: false,
      title: '화면 설정',
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    expect(zoom.attachControl).toHaveBeenCalledWith(first.webContents);
    expect(loadPage).toHaveBeenCalledWith(
      first,
      {name: 'index', query: {window: 'screens'}},
      expect.anything(),
    );
    first.emit('ready-to-show');
    expect(first.show).toHaveBeenCalledOnce();
    open();
    expect(mocks.created).toHaveLength(2);
    expect(first.restore).toHaveBeenCalledOnce();
    expect(first.focus).toHaveBeenCalledOnce();
    first.destroy();
    open();
    expect(last()).not.toBe(first);
    stop();
    expect(last().destroy).toHaveBeenCalledOnce();
    expect(mocks.ipc.listenerCount(windowEndpoints.openScreens.channel)).toBe(
      0,
    );
  });

  it('restores saved size and place, clamps detached monitors, and remembers normal bounds', () => {
    const {open, last, stop, config} = setup('normal', {
      x: 9000,
      y: -9000,
      width: 1400,
      height: 800,
      maximized: true,
    });
    open();
    const win = last();
    expect(win.options).toMatchObject({x: 520, y: 0, width: 1400, height: 800});
    win.emit('ready-to-show');
    expect(win.maximize).toHaveBeenCalledOnce();
    win.isMaximized.mockReturnValue(true);
    win.emit('move');
    expect(config.setScreensWindow).toHaveBeenLastCalledWith({
      x: 100,
      y: 80,
      width: 1400,
      height: 800,
      maximized: true,
    });
    stop();
  });

  it('destroys the auxiliary window when the control closes and releases the close listener on stop', () => {
    const {control, open, last, stop} = setup();
    open();
    control.emit('closed');
    expect(last().destroy).toHaveBeenCalledOnce();
    stop();
    expect(control.listenerCount('closed')).toBe(0);
  });

  it('never shows, focuses, restores, or maximizes offscreen test windows and releases frames', () => {
    const {open, last, stop, config} = setup('offscreen');
    open();
    const win = last();
    expect(win.options).toMatchObject({
      show: false,
      skipTaskbar: true,
      webPreferences: {offscreen: {useSharedTexture: true}},
    });
    win.emit('ready-to-show');
    open();
    expect(win.show).not.toHaveBeenCalled();
    expect(win.focus).not.toHaveBeenCalled();
    expect(win.restore).not.toHaveBeenCalled();
    expect(win.maximize).not.toHaveBeenCalled();
    const release = vi.fn();
    win.webContents.emit('paint', {texture: {release}});
    expect(release).toHaveBeenCalledOnce();
    stop();
    expect(win.webContents.listenerCount('paint')).toBe(0);
    expect(config.setScreensWindow).not.toHaveBeenCalled();
  });
});
