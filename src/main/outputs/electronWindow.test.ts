import {beforeEach, describe, expect, it, onTestFinished, vi} from 'vitest';
import {installFakeClock} from '../../../test/fake-clock';
import type {Rect} from '../displays/rect';
import type {Logger} from '../log';
import {startLoading} from '../windows/page';
import type {WindowMode} from '../windows/testWindows';
import {createElectronOutputWindow} from './electronWindow';
import designTokens from '../../../design/system/project/tokens.json';
import type {OutputWindowHandle} from './outputWindow';
import type {OutputScreen} from './screens';
import {
  BOUNDS_RECHECK_MS,
  FULLSCREEN_EXIT_DEADLINE_MS,
} from './windowPlacement';

const electron = await vi.hoisted(async () => {
  const {EventEmitter} = await import('node:events');
  class FakeBrowserWindow extends EventEmitter {
    readonly webContents = Object.assign(new EventEmitter(), {
      isCrashed: vi.fn(() => false),
      executeJavaScript: vi.fn(() => Promise.resolve(0)),
      forcefullyCrashRenderer: vi.fn(),
    });
    readonly setContentBounds = vi.fn<(bounds: Rect) => void>();
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
    readonly setBackgroundColor = vi.fn();
    readonly setAlwaysOnTop = vi.fn<(flag: boolean) => void>();
    readonly isVisible = vi.fn(() => false);
    readonly showInactive = vi.fn();
    readonly show = vi.fn();
    readonly focus = vi.fn();
    readonly hide = vi.fn();
    readonly removeMenu = vi.fn();
    readonly isDestroyed = vi.fn(() => false);
    readonly destroy = vi.fn();

    constructor(readonly options: unknown) {
      super();
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

function fakeControl() {
  return {
    isDestroyed: vi.fn(() => false),
    moveAbove: vi.fn<(mediaSourceId: string) => void>(),
    focus: vi.fn(),
  };
}

function openOutput(
  mode: WindowMode,
  control = fakeControl(),
  log = fakeLog(),
): OutputWindowHandle {
  const output = createElectronOutputWindow(
    SCREEN,
    {onRendererGone: vi.fn(), onCloseRequested: vi.fn()},
    {log, mode, control},
  );
  onTestFinished(() => output.destroy());
  return output;
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
  it('sizes capture content without presenting a window or changing its window order', () => {
    const output = openOutput('offscreen');
    output.showCapture({x: 0, y: 0, width: 1920, height: 1080});
    expect(lastWindow().setContentBounds).toHaveBeenCalledWith({
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
    });
    expectNeverPresented(lastWindow());
  });

  it('does not change window order on monitor removal in offscreen mode', () => {
    const control = fakeControl();
    const output = openOutput('offscreen', control);
    output.prepareForMonitorRemoval();
    expect(control.moveAbove).not.toHaveBeenCalled();
    expectNeverPresented(lastWindow());
  });

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
  it.each(['window', 'capture'] as const)(
    'honors an explicit always-on-top choice in %s mode without raising the control',
    method => {
      const control = fakeControl();
      const output = openOutput('normal', control);
      if (method === 'capture') output.showCapture(WINDOW_BOUNDS, true);
      else output.showWindowed(WINDOW_BOUNDS, true);
      expect(lastWindow().setAlwaysOnTop).toHaveBeenLastCalledWith(true);
      expect(control.moveAbove).not.toHaveBeenCalled();
    },
  );

  it('opens a capture window with fixed client size, chroma and drawing enabled while covered', () => {
    const output = createElectronOutputWindow(
      {...SCREEN, method: 'capture'},
      {onRendererGone: vi.fn(), onCloseRequested: vi.fn()},
      {log: fakeLog(), mode: 'normal', control: fakeControl()},
    );
    onTestFinished(() => output.destroy());
    const win = lastWindow();
    expect(win.options).toMatchObject({
      show: false,
      backgroundColor: designTokens.color.tokens.find(
        token => token.name === 'chroma',
      )?.value,
      minimizable: false,
      maximizable: false,
      resizable: false,
      webPreferences: {backgroundThrottling: false},
    });
    output.showCapture(MONITOR);
    expect(win.setContentBounds).toHaveBeenCalledExactlyOnceWith(MONITOR);
    expect(win.setBounds).not.toHaveBeenCalled();
    expect(win.setMinimizable).toHaveBeenLastCalledWith(false);
    expect(win.setAlwaysOnTop).toHaveBeenLastCalledWith(false);
    expect(win.showInactive).toHaveBeenCalledOnce();
    expect(win.focus).not.toHaveBeenCalled();
  });

  it('waits for fullscreen exit, corrects a late client-size restore once, and restores normal flags', async () => {
    const clock = installFakeClock();
    const output = openOutput('normal');
    const win = lastWindow();
    let content = WINDOW_BOUNDS;
    win.getContentBounds.mockImplementation(() => content);
    win.setContentBounds.mockImplementation(bounds => {
      content = bounds;
    });
    win.isFullScreen.mockReturnValue(true);
    win.setFullScreen.mockImplementation(() => {
      win.isFullScreen.mockReturnValue(false);
      win.emit('leave-full-screen');
    });
    output.showCapture(MONITOR);
    expect(win.setContentBounds).not.toHaveBeenCalled();
    await clock.advance(0);
    expect(content).toEqual(MONITOR);
    content = WINDOW_BOUNDS;
    await clock.advance(BOUNDS_RECHECK_MS);
    expect(content).toEqual(MONITOR);
    expect(win.setContentBounds).toHaveBeenCalledTimes(2);
    expect(win.getBounds).not.toHaveBeenCalled();
    output.showWindowed(WINDOW_BOUNDS);
    expect(win.setMinimizable).toHaveBeenLastCalledWith(true);
    expect(win.setResizable).toHaveBeenLastCalledWith(true);
    expect(win.setMaximizable).toHaveBeenLastCalledWith(true);
    expect(win.setBackgroundColor).toHaveBeenLastCalledWith('#000000');
    output.showFullScreen(MONITOR, true);
    expect(win.setAlwaysOnTop).toHaveBeenLastCalledWith(true);
  });

  it('bounds a missing fullscreen-leave event for capture and releases pending work on dispose', async () => {
    const clock = installFakeClock();
    const output = openOutput('normal');
    const win = lastWindow();
    win.isFullScreen.mockReturnValue(true);
    output.showCapture(MONITOR);
    await clock.advance(FULLSCREEN_EXIT_DEADLINE_MS);
    expect(win.setContentBounds).toHaveBeenCalledExactlyOnceWith(MONITOR);
    output.destroy();
    expect(vi.getTimerCount()).toBe(0);
    expect(win.listenerCount('leave-full-screen')).toBe(0);
  });

  it('waits past a synchronous leave event and the restore before fullscreen exit returns', async () => {
    const clock = installFakeClock();
    const output = openOutput('normal');
    const win = lastWindow();
    let bounds = MONITOR;
    win.getBounds.mockImplementation(() => bounds);
    win.setBounds.mockImplementation(next => {
      bounds = next;
    });
    win.isFullScreen.mockReturnValue(true);
    win.setFullScreen.mockImplementation(() => {
      win.isFullScreen.mockReturnValue(false);
      win.emit('leave-full-screen');
      expect(win.setBounds).not.toHaveBeenCalled();
      bounds = {x: 2480, y: 492, width: 960, height: 540};
      win.emit('resize');
    });

    output.showWindowed(WINDOW_BOUNDS);
    expect(bounds.x).toBe(2480);
    await clock.advance(0);
    expect(bounds).toEqual(WINDOW_BOUNDS);
    expect(win.setBounds).toHaveBeenCalledExactlyOnceWith(WINDOW_BOUNDS);
  });

  it.each(['move', 'resize', 'timer'] as const)(
    'corrects a late restore once after %s, then releases its checks',
    async event => {
      const clock = installFakeClock();
      const control = fakeControl();
      const output = openOutput('normal', control);
      const win = lastWindow();
      let bounds = WINDOW_BOUNDS;
      win.getBounds.mockImplementation(() => bounds);
      win.setBounds.mockImplementation(next => {
        bounds = next;
      });
      output.showWindowed(WINDOW_BOUNDS);
      bounds = {...WINDOW_BOUNDS, x: 2480};
      if (event !== 'timer') win.emit(event);
      await clock.advance(event === 'timer' ? BOUNDS_RECHECK_MS : 0);

      expect(bounds).toEqual(WINDOW_BOUNDS);
      expect(win.getBounds).toHaveBeenCalled();
      expect(win.setBounds).toHaveBeenCalledTimes(2);
      expect(control.moveAbove).toHaveBeenCalledTimes(2);
      bounds = {...WINDOW_BOUNDS, x: 300};
      win.emit('move');
      await clock.advance(BOUNDS_RECHECK_MS);
      expect(bounds.x).toBe(300);
      expect(win.setBounds).toHaveBeenCalledTimes(2);
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it.each(['window', 'fullscreen'] as const)(
    'releases a missing leave event and applies the latest %s request by its deadline',
    async request => {
      const clock = installFakeClock();
      const output = openOutput('normal');
      const win = lastWindow();
      win.isFullScreen.mockReturnValue(true);
      output.showWindowed(WINDOW_BOUNDS);
      win.isFullScreen.mockReturnValue(false);
      if (request === 'fullscreen') output.showFullScreen(MONITOR, true);
      await clock.advance(FULLSCREEN_EXIT_DEADLINE_MS - 1);
      expect(win.setBounds).not.toHaveBeenCalled();
      await clock.advance(1);
      if (request === 'window') {
        expect(win.setBounds).toHaveBeenCalledWith(WINDOW_BOUNDS);
      } else {
        expect(win.setFullScreen).toHaveBeenLastCalledWith(true);
        expect(win.setAlwaysOnTop).toHaveBeenLastCalledWith(true);
      }
      output.destroy();
      expect(vi.getTimerCount()).toBe(0);
      expect(win.listenerCount('leave-full-screen')).toBe(0);
    },
  );

  it('restores always on top after disconnect, fallback, and fullscreen reconnect', async () => {
    const clock = installFakeClock();
    const output = openOutput('normal');
    const win = lastWindow();
    output.showFullScreen(MONITOR, true);
    win.isFullScreen.mockReturnValue(true);
    output.prepareForMonitorRemoval();
    output.showWindowed(WINDOW_BOUNDS);
    win.isFullScreen.mockReturnValue(false);
    win.emit('leave-full-screen');
    await clock.advance(0);
    expect(win.setAlwaysOnTop).toHaveBeenLastCalledWith(false);
    expect(win.setBounds).toHaveBeenLastCalledWith(WINDOW_BOUNDS);

    output.showFullScreen(MONITOR, true);

    expect(win.setAlwaysOnTop).toHaveBeenLastCalledWith(true);
    expect(win.setFullScreen).toHaveBeenLastCalledWith(true);
    expect(win.focus).not.toHaveBeenCalled();
    output.destroy();
  });

  it('drops always on top before moving the control above it, immediately and after placement', () => {
    const control = fakeControl();
    const output = openOutput('normal', control);
    const win = lastWindow();
    const calls: string[] = [];
    win.setAlwaysOnTop.mockImplementation(flag => calls.push(`top:${flag}`));
    control.moveAbove.mockImplementation(id => calls.push(`above:${id}`));
    win.setBounds.mockImplementation(() => {
      calls.push('bounds');
    });
    win.showInactive.mockImplementation(() => calls.push('showInactive'));

    output.prepareForMonitorRemoval();
    expect(calls).toEqual(['top:false', 'above:window:42:0']);
    expect(win.hide).not.toHaveBeenCalled();
    expect(win.setFullScreen).not.toHaveBeenCalled();
    calls.length = 0;
    output.showWindowed(WINDOW_BOUNDS);
    expect(calls).toEqual([
      'top:false',
      'bounds',
      'showInactive',
      'top:false',
      'above:window:42:0',
    ]);
    expect(win.focus).not.toHaveBeenCalled();
    expect(win.show).not.toHaveBeenCalled();
    expect(control.focus).not.toHaveBeenCalled();
  });

  it('applies planned bounds after Windows restores the pre-fullscreen bounds', async () => {
    const clock = installFakeClock();
    const control = fakeControl();
    const output = openOutput('normal', control);
    const win = lastWindow();
    let bounds = {x: 3920, y: 492, width: 960, height: 540};
    win.setBounds.mockImplementation(next => {
      bounds = next;
    });
    win.isFullScreen.mockReturnValue(true);
    output.showWindowed(WINDOW_BOUNDS);

    expect(win.setFullScreen).toHaveBeenCalledWith(false);
    expect(win.setBounds).not.toHaveBeenCalled();
    expect(control.moveAbove).not.toHaveBeenCalled();
    expect(bounds).toEqual({x: 3920, y: 492, width: 960, height: 540});
    bounds = {x: 2480, y: 492, width: 960, height: 540};
    win.isFullScreen.mockReturnValue(false);
    win.emit('leave-full-screen');
    await clock.advance(0);

    expect(bounds).toEqual(WINDOW_BOUNDS);
    expect(win.setBounds).toHaveBeenCalledExactlyOnceWith(WINDOW_BOUNDS);
    expect(control.moveAbove).toHaveBeenCalledExactlyOnceWith('window:42:0');
    expect(win.setAlwaysOnTop).toHaveBeenCalledBefore(control.moveAbove);
    expect(win.setBounds).toHaveBeenCalledBefore(control.moveAbove);
    expect(win.showInactive).toHaveBeenCalledBefore(control.moveAbove);
    expect(win.focus).not.toHaveBeenCalled();
    expect(control.focus).not.toHaveBeenCalled();
    expect(win.listenerCount('leave-full-screen')).toBe(1);
    output.destroy();
    expect(win.listenerCount('leave-full-screen')).toBe(0);
  });

  it('places the control directly above a windowed output without focusing either', () => {
    const control = fakeControl();
    const output = openOutput('normal', control);
    const win = lastWindow();

    output.showWindowed(WINDOW_BOUNDS);

    expect(control.moveAbove).toHaveBeenCalledExactlyOnceWith('window:42:0');
    expect(win.setAlwaysOnTop).toHaveBeenCalledWith(false);
    expect(win.setAlwaysOnTop).toHaveBeenCalledBefore(control.moveAbove);
    expect(win.setBounds).toHaveBeenCalledBefore(control.moveAbove);
    expect(win.focus).not.toHaveBeenCalled();
    expect(control.focus).not.toHaveBeenCalled();
  });

  it.each(['hide', 'destroy', 'closed', 'fullscreen'] as const)(
    'cancels a pending fallback placement on %s',
    async action => {
      const clock = installFakeClock();
      const control = fakeControl();
      const output = openOutput('normal', control);
      const win = lastWindow();
      win.isFullScreen.mockReturnValue(true);
      output.showWindowed(WINDOW_BOUNDS);

      switch (action) {
        case 'hide':
          output.hide();
          break;
        case 'destroy':
          output.destroy();
          break;
        case 'closed':
          win.isDestroyed.mockReturnValue(true);
          win.emit('closed');
          break;
        case 'fullscreen':
          output.showFullScreen(MONITOR, true);
          break;
      }
      win.isFullScreen.mockReturnValue(false);
      win.emit('leave-full-screen');
      await clock.advance(0);

      expect(win.setBounds).not.toHaveBeenCalledWith(WINDOW_BOUNDS);
      expect(control.moveAbove).not.toHaveBeenCalled();
      if (action === 'fullscreen') {
        expect(win.setFullScreen).toHaveBeenLastCalledWith(true);
        expect(win.setAlwaysOnTop).toHaveBeenLastCalledWith(true);
      } else expect(win.showInactive).not.toHaveBeenCalled();
      output.destroy();
      expect(win.listenerCount('leave-full-screen')).toBe(0);
      expect(win.listenerCount('closed')).toBe(0);
      expect(win.listenerCount('move')).toBe(0);
      expect(win.listenerCount('resize')).toBe(0);
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it('waits for fullscreen exit even when hidden and shown again during the transition', async () => {
    const clock = installFakeClock();
    const output = openOutput('normal');
    const win = lastWindow();
    win.isFullScreen.mockReturnValue(true);
    output.showWindowed(WINDOW_BOUNDS);
    output.hide();
    win.isFullScreen.mockReturnValue(false);
    const next = {...WINDOW_BOUNDS, x: 200};
    output.showWindowed(next);
    expect(win.setBounds).not.toHaveBeenCalled();
    win.emit('leave-full-screen');
    await clock.advance(0);
    expect(win.setBounds).toHaveBeenCalledExactlyOnceWith(next);
    output.destroy();
  });

  it('retains the planned bounds when a fallback is shown again before its first placement', async () => {
    const clock = installFakeClock();
    const output = openOutput('normal');
    const win = lastWindow();
    win.isFullScreen.mockReturnValue(true);
    output.showWindowed(WINDOW_BOUNDS);
    output.hide();
    win.isFullScreen.mockReturnValue(false);
    win.emit('leave-full-screen');
    await clock.advance(0);
    expect(win.setBounds).not.toHaveBeenCalled();
    output.showWindowed(null);
    expect(win.setBounds).toHaveBeenCalledExactlyOnceWith(WINDOW_BOUNDS);
    output.destroy();
  });

  it('logs a failed deferred placement instead of throwing from the native event', async () => {
    const clock = installFakeClock();
    const log = fakeLog();
    const output = openOutput('normal', fakeControl(), log);
    const win = lastWindow();
    const failure = new Error('window no longer accepts bounds');
    win.isFullScreen.mockReturnValue(true);
    output.showWindowed(WINDOW_BOUNDS);
    win.setBounds.mockImplementation(() => {
      throw failure;
    });
    expect(() => win.emit('leave-full-screen')).not.toThrow();
    await clock.advance(0);
    expect(log.error).toHaveBeenCalledExactlyOnceWith(
      'could not place the output after leaving full screen',
      failure,
    );
    output.destroy();
  });

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
