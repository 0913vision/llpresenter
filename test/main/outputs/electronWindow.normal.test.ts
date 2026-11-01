import {
  MONITOR,
  WINDOW_BOUNDS,
  SCREEN,
  mockLog,
  mockControl,
  openOutput,
  lastWindow,
} from '@fixtures/main/outputs/electronWindowFixtures';
import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {installMockClock} from '../../mock-clock';
import {startLoading} from '@main/windows/page';
import {createElectronOutputWindow} from '@main/outputs/electronWindow';
import {ON_TOP_CHECK_MS} from '@main/outputs/onTopKeeper';
import designTokens from '../../../design/system/project/tokens.json';
import {
  BOUNDS_RECHECK_MS,
  FULLSCREEN_EXIT_DEADLINE_MS,
} from '@main/outputs/windowPlacement';

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
  it('does not change the prepared viewport through an intermediate half-size on first reveal', () => {
    const output = openOutput('normal');
    const win = lastWindow();
    win.getContentBounds.mockReturnValue(MONITOR);
    output.showFullScreen(MONITOR, true);
    expect(win.setBounds).not.toHaveBeenCalled();
    expect(win.showInactive).toHaveBeenCalledOnce();
  });
  it.each(['fullscreen', 'window', 'capture'] as const)(
    'changes only its own stacking when always on top changes in %s mode',
    method => {
      const control = mockControl();
      const output = openOutput('normal', control);
      const win = lastWindow();
      if (method === 'fullscreen') output.showFullScreen(MONITOR, false);
      else if (method === 'window') output.showWindowed(WINDOW_BOUNDS);
      else output.showCapture(MONITOR);
      vi.clearAllMocks();
      for (let index = 0; index < 20; index += 1) {
        output.setAlwaysOnTop(index % 2 === 0);
      }
      expect(win.setAlwaysOnTop).toHaveBeenCalledTimes(20);
      expect(win.setFullScreen).not.toHaveBeenCalled();
      expect(win.setBounds).not.toHaveBeenCalled();
      expect(win.setContentBounds).not.toHaveBeenCalled();
      expect(win.setFocusable).not.toHaveBeenCalled();
      expect(win.showInactive).not.toHaveBeenCalled();
      expect(win.moveTop).not.toHaveBeenCalled();
      expect(win.focus).not.toHaveBeenCalled();
      expect(control.moveAbove).not.toHaveBeenCalled();
      expect(control.focus).not.toHaveBeenCalled();
    },
  );

  it('keeps the latest stacking choice when a pending fullscreen exit finishes', async () => {
    const clock = installMockClock();
    const output = openOutput('normal');
    const win = lastWindow();
    win.isFullScreen.mockReturnValue(true);
    output.showWindowed(WINDOW_BOUNDS, true);
    output.setAlwaysOnTop(false);
    win.isFullScreen.mockReturnValue(false);
    win.emit('leave-full-screen');
    await clock.advance(0);
    expect(win.setAlwaysOnTop).toHaveBeenLastCalledWith(false);
    expect(vi.getTimerCount()).toBe(1);
    output.destroy();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('raises a non-topmost output once on show and never keeps raising it', async () => {
    const clock = installMockClock();
    const control = mockControl();
    const output = openOutput('normal', control);
    const win = lastWindow();
    output.showFullScreen(MONITOR, false);
    expect(win.moveTop).toHaveBeenCalledOnce();
    expect(win.setAlwaysOnTop).toHaveBeenLastCalledWith(false);
    expect(control.moveAbove).not.toHaveBeenCalled();
    await clock.advance(ON_TOP_CHECK_MS * 3);
    expect(win.moveTop).toHaveBeenCalledOnce();
    output.bringToFront();
    expect(win.moveTop).toHaveBeenCalledTimes(2);
    output.hide();
    output.showFullScreen(MONITOR, false);
    expect(win.moveTop).toHaveBeenCalledTimes(3);
  });
  it.each(['window', 'capture'] as const)(
    'honors an explicit always-on-top choice in %s mode without raising the control',
    method => {
      const control = mockControl();
      const output = openOutput('normal', control);
      if (method === 'capture') output.showCapture(WINDOW_BOUNDS, true);
      else output.showWindowed(WINDOW_BOUNDS, true);
      expect(lastWindow().setAlwaysOnTop).toHaveBeenLastCalledWith(
        true,
        'screen-saver',
      );
      expect(control.moveAbove).not.toHaveBeenCalled();
    },
  );

  it('reports where the window is now, and nothing once it is destroyed', () => {
    const output = openOutput('normal');
    const win = lastWindow();
    const moved = {x: 100, y: 50, width: 1280, height: 760};
    win.getBounds.mockImplementation(() => moved);
    expect(output.bounds()).toEqual(moved);
    win.isDestroyed.mockImplementation(() => true);
    expect(output.bounds()).toBeNull();
  });

  it('opens a capture window with fixed client size, chroma and drawing enabled while covered', () => {
    const output = createElectronOutputWindow(
      {...SCREEN, method: 'capture'},
      {onRendererGone: vi.fn(), onCloseRequested: vi.fn()},
      {log: mockLog(), mode: 'normal', control: mockControl()},
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
    const clock = installMockClock();
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
    expect(win.setAlwaysOnTop).toHaveBeenLastCalledWith(true, 'screen-saver');
  });

  it('bounds a missing fullscreen-leave event for capture and releases pending work on dispose', async () => {
    const clock = installMockClock();
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
    const clock = installMockClock();
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
      const clock = installMockClock();
      const control = mockControl();
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
      expect(control.moveAbove).not.toHaveBeenCalled();
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
      const clock = installMockClock();
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
        expect(win.setAlwaysOnTop).toHaveBeenLastCalledWith(
          true,
          'screen-saver',
        );
      }
      output.destroy();
      expect(vi.getTimerCount()).toBe(0);
      expect(win.listenerCount('leave-full-screen')).toBe(0);
    },
  );
});
