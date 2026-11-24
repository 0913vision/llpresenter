import {
  MONITOR,
  WINDOW_BOUNDS,
  mockControl,
  openOutput,
  lastWindow,
} from '@fixtures/main/outputs/electronWindowFixtures';
import {describe, expect, it, vi} from 'vitest';
import {installMockClock} from '@fixtures/mockClock';

describe('createElectronOutputWindow normal', () => {
  it('restores always on top after disconnect, fallback, and fullscreen reconnect', async () => {
    const clock = installMockClock();
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
    expect(win.setContentBounds).toHaveBeenLastCalledWith(WINDOW_BOUNDS);

    output.showFullScreen(MONITOR, true);

    expect(win.setAlwaysOnTop).toHaveBeenLastCalledWith(true, 'screen-saver');
    expect(win.setFullScreen).toHaveBeenLastCalledWith(true);
    expect(win.focus).not.toHaveBeenCalled();
    output.destroy();
  });

  it('drops always on top before moving the control above it, immediately and after placement', () => {
    const control = mockControl();
    const output = openOutput('normal', control);
    const win = lastWindow();
    const calls: string[] = [];
    win.setAlwaysOnTop.mockImplementation(flag => calls.push(`top:${flag}`));
    control.moveAbove.mockImplementation(id => calls.push(`above:${id}`));
    win.setContentBounds.mockImplementation(() => {
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

  it('raises a windowed output once without focusing or moving the control', () => {
    const control = mockControl();
    const output = openOutput('normal', control);
    const win = lastWindow();

    output.showWindowed(WINDOW_BOUNDS);

    expect(control.moveAbove).not.toHaveBeenCalled();
    expect(win.moveTop).toHaveBeenCalledOnce();
    expect(win.setAlwaysOnTop).toHaveBeenCalledWith(false);
    expect(win.focus).not.toHaveBeenCalled();
    expect(control.focus).not.toHaveBeenCalled();
  });

  it.each(['hide', 'destroy', 'closed', 'fullscreen'] as const)(
    'cancels a pending fallback placement on %s',
    async action => {
      const clock = installMockClock();
      const control = mockControl();
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

      expect(win.setContentBounds).not.toHaveBeenCalledWith(WINDOW_BOUNDS);
      expect(control.moveAbove).not.toHaveBeenCalled();
      if (action === 'fullscreen') {
        expect(win.setFullScreen).toHaveBeenLastCalledWith(true);
        expect(win.setAlwaysOnTop).toHaveBeenLastCalledWith(
          true,
          'screen-saver',
        );
      } else expect(win.showInactive).not.toHaveBeenCalled();
      output.destroy();
      expect(win.listenerCount('leave-full-screen')).toBe(0);
      expect(win.listenerCount('closed')).toBe(0);
      expect(win.listenerCount('move')).toBe(0);
      expect(win.listenerCount('resize')).toBe(0);
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it('retains the planned bounds when a fallback is shown again before its first placement', async () => {
    const clock = installMockClock();
    const output = openOutput('normal');
    const win = lastWindow();
    win.isFullScreen.mockReturnValue(true);
    output.showWindowed(WINDOW_BOUNDS);
    output.hide();
    win.isFullScreen.mockReturnValue(false);
    win.emit('leave-full-screen');
    await clock.advance(0);
    expect(win.setContentBounds).not.toHaveBeenCalled();
    output.showWindowed(null);
    expect(win.setContentBounds).toHaveBeenCalledExactlyOnceWith(WINDOW_BOUNDS);
    output.destroy();
  });

  it('shows a full screen output on its monitor without taking focus', () => {
    const output = openOutput('normal');
    const win = lastWindow();

    output.showFullScreen(MONITOR, true);

    if (process.platform === 'win32') {
      expect(win.setFocusable).toHaveBeenCalledWith(false);
    }
    expect(win.setSkipTaskbar).toHaveBeenCalledWith(true);
    expect(win.setFullScreen).toHaveBeenCalledWith(true);
    expect(win.setAlwaysOnTop).toHaveBeenCalledWith(true, 'screen-saver');
    expect(win.showInactive).toHaveBeenCalledTimes(1);
    expect(win.focus).not.toHaveBeenCalled();
  });

  it('restores taskbar visibility and focusability when fullscreen falls back to a window', async () => {
    const clock = installMockClock();
    const output = openOutput('normal');
    const win = lastWindow();
    output.showFullScreen(MONITOR, true);
    expect(win.setSkipTaskbar).toHaveBeenLastCalledWith(true);
    win.isFullScreen.mockReturnValue(true);
    output.showWindowed(WINDOW_BOUNDS);
    win.isFullScreen.mockReturnValue(false);
    win.emit('leave-full-screen');
    await clock.advance(0);
    expect(win.setFocusable).toHaveBeenLastCalledWith(true);
    expect(win.setSkipTaskbar).toHaveBeenLastCalledWith(false);
    expect(win.setFocusable.mock.invocationCallOrder.at(-1)).toBeLessThan(
      win.setSkipTaskbar.mock.invocationCallOrder.at(-1) ?? Infinity,
    );
  });

  it('opens hidden with the normal window options', () => {
    openOutput('normal');

    expect(lastWindow().options).toMatchObject({
      show: false,
      focusable: true,
      webPreferences: {backgroundThrottling: false},
    });
    expect(lastWindow().options).not.toHaveProperty('skipTaskbar');
    expect(lastWindow().options).not.toHaveProperty('webPreferences.offscreen');
    expect(lastWindow().webContents.listenerCount('paint')).toBe(0);
  });
});
