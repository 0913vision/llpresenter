import {
  MONITOR,
  WINDOW_BOUNDS,
  mockLog,
  mockControl,
  openOutput,
  lastWindow,
} from '@fixtures/main/outputs/electronWindowFixtures';
import {describe, expect, it, vi} from 'vitest';
import {installMockClock} from '../../mock-clock';
import {ON_TOP_CHECK_MS} from '@main/outputs/onTopKeeper';

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
    expect(win.setBounds).toHaveBeenLastCalledWith(WINDOW_BOUNDS);

    output.showFullScreen(MONITOR, true);

    expect(win.setAlwaysOnTop).toHaveBeenLastCalledWith(true, 'screen-saver');
    expect(win.setFullScreen).toHaveBeenLastCalledWith(true);
    expect(win.focus).not.toHaveBeenCalled();
    output.destroy();
  });

  it('restores a full screen output that loses always on top, and stops checking once hidden', async () => {
    const clock = installMockClock();
    const log = mockLog();
    const output = openOutput('normal', mockControl(), log);
    const win = lastWindow();
    output.showFullScreen(MONITOR, true);
    win.onTop = false;
    win.emit('always-on-top-changed', {}, false);
    expect(win.setAlwaysOnTop).toHaveBeenLastCalledWith(true, 'screen-saver');
    expect(log.warn).toHaveBeenCalledOnce();
    output.hide();
    win.setAlwaysOnTop.mockClear();
    win.onTop = false;
    await clock.advance(ON_TOP_CHECK_MS * 2);
    win.emit('always-on-top-changed', {}, false);
    expect(win.setAlwaysOnTop).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledOnce();
    expect(log.error).not.toHaveBeenCalled();
    output.destroy();
  });

  it('ignores a level change while moving into full screen and sets the level after', () => {
    const log = mockLog();
    const output = openOutput('normal', mockControl(), log);
    const win = lastWindow();
    output.showFullScreen(MONITOR, true);
    win.isFullScreen.mockReturnValue(true);
    win.setFullScreen.mockImplementation(flag => {
      if (flag) return;
      win.onTop = false;
      win.emit('always-on-top-changed', {}, false);
    });
    win.setAlwaysOnTop.mockClear();
    output.showFullScreen(WINDOW_BOUNDS, true);
    expect(win.setFullScreen.mock.calls.slice(-2)).toEqual([[false], [true]]);
    expect(win.setAlwaysOnTop.mock.calls).toEqual([[true, 'screen-saver']]);
    expect(log.warn).not.toHaveBeenCalled();
    output.destroy();
  });

  it('drops always on top before moving the control above it, immediately and after placement', () => {
    const control = mockControl();
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
    const clock = installMockClock();
    const control = mockControl();
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
    expect(control.moveAbove).not.toHaveBeenCalled();
    expect(win.moveTop).toHaveBeenCalledOnce();
    expect(win.focus).not.toHaveBeenCalled();
    expect(control.focus).not.toHaveBeenCalled();
    expect(win.listenerCount('leave-full-screen')).toBe(1);
    output.destroy();
    expect(win.listenerCount('leave-full-screen')).toBe(0);
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

      expect(win.setBounds).not.toHaveBeenCalledWith(WINDOW_BOUNDS);
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

  it('waits for fullscreen exit even when hidden and shown again during the transition', async () => {
    const clock = installMockClock();
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
    const clock = installMockClock();
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
    const clock = installMockClock();
    const log = mockLog();
    const output = openOutput('normal', mockControl(), log);
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

    expect(win.setFocusable).toHaveBeenCalledWith(true);
    expect(win.setFullScreen).toHaveBeenCalledWith(true);
    expect(win.setAlwaysOnTop).toHaveBeenCalledWith(true, 'screen-saver');
    expect(win.showInactive).toHaveBeenCalledTimes(1);
    expect(win.focus).not.toHaveBeenCalled();
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
