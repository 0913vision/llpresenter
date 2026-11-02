import {BrowserWindow} from 'electron';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {AppConfig} from '@core/schema/appConfig';
import {windowEndpoints} from '@contracts/ipc/window';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {emptyLiveState} from '@core/live/state';
import {guardTestPatterns} from '@main/outputs/testPatternGuard';
import {registerScreensWindow} from '@main/windows/screens';
import type {ControlCloseOptions} from '@main/windows/controlClose';
import {loadPage} from '@main/windows/page';

const mocks = await vi.hoisted(async () => {
  const {EventEmitter} = await import('node:events');
  class MockWindow extends EventEmitter {
    destroyed = false;
    readonly webContents = Object.assign(new EventEmitter(), {
      setAudioMuted: vi.fn(),
      isDestroyed: () => this.destroyed,
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
  const workArea = {x: 0, y: 0, width: 1920, height: 1080};
  const createHandshake = () => ({
    confirmClose: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
    dispose: vi.fn(),
  });
  return {
    MockWindow,
    created,
    workArea,
    ipc: new EventEmitter(),
    quit: vi.fn(),
    closeOptions: new Array<ControlCloseOptions>(),
    handshakes: new Array<ReturnType<typeof createHandshake>>(),
    createHandshake,
    guardStops: new Array<ReturnType<typeof vi.fn<() => void>>>(),
  };
});

vi.mock('electron', () => ({
  app: {quit: mocks.quit},
  BrowserWindow: mocks.MockWindow,
  ipcMain: mocks.ipc,
  screen: {
    getPrimaryDisplay: () => ({
      workArea: mocks.workArea,
    }),
    getDisplayMatching: () => ({
      workArea: mocks.workArea,
    }),
  },
}));
vi.mock('@main/windows/controlClose', () => ({
  registerControlClose: (options: ControlCloseOptions) => {
    mocks.closeOptions.push(options);
    const handshake = mocks.createHandshake();
    mocks.handshakes.push(handshake);
    return handshake;
  },
}));
vi.mock('@main/outputs/testPatternGuard', () => ({
  guardTestPatterns: vi.fn(() => {
    const stop = vi.fn<() => void>();
    mocks.guardStops.push(stop);
    return stop;
  }),
}));
vi.mock('@main/windows/page', () => ({
  preloadPath: 'preload.js',
  loadPage: vi.fn(),
  blockNavigation: vi.fn(),
}));

beforeEach(() => {
  mocks.quit.mockClear();
  mocks.handshakes.length = 0;
  mocks.closeOptions.length = 0;
  mocks.created.length = 0;
  Object.assign(mocks.workArea, {width: 1920, height: 1080});
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
  const store = {
    state: emptyLiveState(),
    handles: vi.fn(() => true),
    dispatch: vi.fn(() => true),
  };
  const options = {
    control,
    store,
    config,
    zoom,
    mode,
    log: recordingLogger(),
  };
  const owner = registerScreensWindow(options);
  const open = () => mocks.ipc.emit(windowEndpoints.openScreens.channel);
  const last = () => {
    const win = mocks.created.at(-1);
    if (win === undefined || mocks.created.length < 2) {
      throw new Error('Missing screens window');
    }
    return win;
  };
  return {control, config, zoom, store, owner, stop: owner.dispose, open, last};
}

describe('screen configuration window', () => {
  it('reloads the settings page after its renderer crashes', async () => {
    const {open, last, stop} = setup();
    open();
    last().webContents.emit('render-process-gone', {}, {reason: 'crashed'});
    expect(loadPage).toHaveBeenCalledTimes(2);
    await stop();
  });

  it('guards the test patterns of each settings window and stops guarding when it closes', async () => {
    const {open, last, stop, store} = setup();
    open();
    const first = last();
    const stopFirst = mocks.guardStops.at(-1);
    expect(guardTestPatterns).toHaveBeenLastCalledWith(
      expect.objectContaining({control: first, store}),
    );
    first.destroy();
    expect(stopFirst).toHaveBeenCalledOnce();

    open();
    const stopSecond = mocks.guardStops.at(-1);
    await stop();
    expect(stopSecond).toHaveBeenCalledOnce();
  });

  it('opens once, restores and focuses on repeat, and opens afresh after close', async () => {
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
    await stop();
    expect(last().destroy).toHaveBeenCalledOnce();
    expect(mocks.ipc.listenerCount(windowEndpoints.openScreens.channel)).toBe(
      0,
    );
  });

  it('never asks for a minimum size larger than a small work area', async () => {
    Object.assign(mocks.workArea, {width: 1200, height: 680});
    const {open, last, stop} = setup();
    open();

    expect(last().options).toMatchObject({
      width: 1200,
      height: 680,
      minWidth: 1200,
      minHeight: 680,
    });
    await stop();
  });

  it('restores saved size and place, clamps detached monitors, and remembers normal bounds', async () => {
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
    await stop();
  });

  it('flushes the auxiliary window when the control closes and releases the close listener on stop', async () => {
    const {control, open, last, stop} = setup();
    open();
    control.emit('closed');
    await vi.waitFor(() => expect(last().destroy).toHaveBeenCalledOnce());
    await stop();
    expect(control.listenerCount('closed')).toBe(0);
  });

  it('never shows, focuses, restores, or maximizes offscreen test windows', async () => {
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
    await stop();
    expect(config.setScreensWindow).not.toHaveBeenCalled();
  });

  it('waits for the close flush and preserves the window after a refusal', async () => {
    const {owner, open, last, stop} = setup();
    open();
    const handshake = mocks.handshakes.at(-1);
    if (handshake === undefined) throw new Error('Missing window handshake');
    let reply: (value: boolean) => void = () => undefined;
    handshake.confirmClose.mockReturnValueOnce(
      new Promise(resolve => {
        reply = resolve;
      }),
    );
    const closing = owner.close();
    expect(last().destroy).not.toHaveBeenCalled();
    reply(false);
    await expect(closing).resolves.toBe(false);
    expect(last().destroy).not.toHaveBeenCalled();
    await expect(owner.close()).resolves.toBe(true);
    expect(last().destroy).toHaveBeenCalledOnce();
    expect(handshake.dispose).toHaveBeenCalledOnce();
    await stop();
  });

  it('restarts app shutdown when a remaining settings window finishes closing', async () => {
    const {control, open, last, stop} = setup();
    open();
    const handshake = mocks.handshakes.at(-1);
    if (handshake === undefined) throw new Error('Missing window handshake');
    handshake.confirmClose.mockResolvedValueOnce(false);
    control.destroy();
    await vi.waitFor(() =>
      expect(handshake.confirmClose).toHaveBeenCalledOnce(),
    );
    expect(last().destroy).not.toHaveBeenCalled();
    last().destroy();
    expect(mocks.quit).toHaveBeenCalledOnce();
    await stop();
  });
});
