import {
  MONITOR,
  WINDOW_BOUNDS,
  mockControl,
  openOutput,
  lastWindow,
  expectNeverPresented,
} from '@fixtures/main/outputs/electronWindowFixtures';
import {describe, expect, it, vi} from 'vitest';
import {installMockClock} from '@fixtures/mockClock';
import {BOUNDS_RECHECK_MS} from '@main/outputs/windowPlacement';

describe('createElectronOutputWindow offscreen', () => {
  it.each(['normal', 'offscreen'] as const)(
    'reports client size independently of outer bounds in %s mode',
    mode => {
      const output = openOutput(mode);
      const win = lastWindow();
      win.getBounds.mockReturnValue({x: 100, y: 100, width: 976, height: 579});
      win.getContentBounds.mockReturnValue({
        x: 108,
        y: 131,
        width: 960,
        height: 540,
      });
      expect(output.bounds()).toMatchObject({width: 976, height: 579});
      expect(output.contentSize()).toMatchObject({width: 960, height: 540});
    },
  );
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

  it('raises a shown window for 창 보기 without focusing it', () => {
    const output = openOutput('normal');
    const win = lastWindow();
    output.bringToFront();
    expect(win.moveTop).not.toHaveBeenCalled();

    win.isVisible.mockReturnValue(true);
    output.bringToFront();
    expect(win.moveTop).toHaveBeenCalledTimes(1);
    expect(win.focus).not.toHaveBeenCalled();
  });

  it('restores a minimized output without focus before raising it', () => {
    const output = openOutput('normal');
    const win = lastWindow();
    const calls: string[] = [];
    win.isMinimized.mockReturnValue(true);
    win.showInactive.mockImplementation(() => calls.push('showInactive'));
    win.moveTop.mockImplementation(() => calls.push('moveTop'));

    output.bringToFront();

    expect(calls).toEqual(['showInactive', 'moveTop']);
    expect(win.focus).not.toHaveBeenCalled();
    expect(win.show).not.toHaveBeenCalled();
  });

  it('does not raise again when fallback placement finishes after 창 보기', async () => {
    const clock = installMockClock();
    const control = mockControl();
    const output = openOutput('normal', control);
    const win = lastWindow();
    output.showFullScreen(MONITOR, true);
    win.isFullScreen.mockReturnValue(true);
    win.isVisible.mockReturnValue(true);
    output.showWindowed(WINDOW_BOUNDS);

    output.bringToFront();
    expect(win.moveTop).toHaveBeenCalledTimes(2);
    win.isFullScreen.mockReturnValue(false);
    win.emit('leave-full-screen');
    await clock.advance(0);

    expect(win.setContentBounds).toHaveBeenCalledWith(WINDOW_BOUNDS);
    expect(win.moveTop).toHaveBeenCalledTimes(2);
    expect(control.moveAbove).not.toHaveBeenCalled();
    output.destroy();
  });

  it('keeps the raise when a late bounds correction runs after 창 보기', async () => {
    const clock = installMockClock();
    const control = mockControl();
    const output = openOutput('normal', control);
    const win = lastWindow();
    let bounds = WINDOW_BOUNDS;
    win.getContentBounds.mockImplementation(() => bounds);
    win.setContentBounds.mockImplementation(next => {
      bounds = next;
    });
    output.showWindowed(WINDOW_BOUNDS);
    expect(control.moveAbove).not.toHaveBeenCalled();
    win.isVisible.mockReturnValue(true);
    output.bringToFront();

    bounds = {...WINDOW_BOUNDS, x: 2480};
    win.emit('move');
    await clock.advance(0);

    expect(bounds).toEqual(WINDOW_BOUNDS);
    expect(win.moveTop).toHaveBeenCalledTimes(2);
    expect(control.moveAbove).not.toHaveBeenCalled();
    output.destroy();
  });

  it.each([
    ['after its placement has settled', true],
    ['while its bounds check was still running', false],
  ] as const)(
    'leaves the control alone during a later independent placement %s',
    async (_when, settledFirst) => {
      const clock = installMockClock();
      const control = mockControl();
      const output = openOutput('normal', control);
      const win = lastWindow();
      win.getContentBounds.mockImplementation(() => WINDOW_BOUNDS);
      output.showWindowed(WINDOW_BOUNDS);
      win.isVisible.mockReturnValue(true);
      if (settledFirst) await clock.advance(BOUNDS_RECHECK_MS);
      output.bringToFront();
      if (!settledFirst) await clock.advance(BOUNDS_RECHECK_MS);
      expect(win.moveTop).toHaveBeenCalledTimes(2);
      control.moveAbove.mockClear();

      const recentered = {...WINDOW_BOUNDS, x: 200};
      win.getContentBounds.mockImplementation(() => recentered);
      output.showWindowed(recentered);

      expect(control.moveAbove).not.toHaveBeenCalled();
      expect(win.moveTop).toHaveBeenCalledTimes(2);
      output.destroy();
    },
  );

  it.each(['hide', 'full screen', 'monitor removal'] as const)(
    'only monitor removal demotes the output after %s',
    end => {
      const control = mockControl();
      const output = openOutput('normal', control);
      const win = lastWindow();
      win.isVisible.mockReturnValue(true);
      output.bringToFront();
      if (end === 'hide') output.hide();
      if (end === 'full screen') output.showFullScreen(MONITOR, true);
      if (end === 'monitor removal') output.prepareForMonitorRemoval();
      control.moveAbove.mockClear();

      output.showWindowed(WINDOW_BOUNDS);

      expect(control.moveAbove).toHaveBeenCalledTimes(
        end === 'monitor removal' ? 1 : 0,
      );
      expect(win.moveTop).toHaveBeenCalledTimes(1);
      output.destroy();
    },
  );

  it('never raises a window in offscreen mode', () => {
    const output = openOutput('offscreen');
    lastWindow().isVisible.mockReturnValue(true);
    output.bringToFront();
    expect(lastWindow().moveTop).not.toHaveBeenCalled();
  });

  it('does not change window order on monitor removal in offscreen mode', () => {
    const control = mockControl();
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

    expect(win.setContentBounds).toHaveBeenCalledWith(WINDOW_BOUNDS);
    expectNeverPresented(win);
  });

  it('keeps the size of a windowed output when no bounds are given', () => {
    const output = openOutput('offscreen');
    const win = lastWindow();

    output.showWindowed(null);

    expect(win.setContentBounds).not.toHaveBeenCalled();
    expectNeverPresented(win);
  });
});
