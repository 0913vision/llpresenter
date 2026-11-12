import {
  expectNeverPresented,
  lastWindow,
  mockControl,
  mockLog,
  openOutput,
  MONITOR,
  WINDOW_BOUNDS,
} from '@fixtures/main/outputs/electronWindowFixtures';
import {describe, expect, it} from 'vitest';

describe('hidden output painting', () => {
  it.each(['normal', 'offscreen'] as const)(
    'uses content bounds and locks only windowed output in %s mode',
    mode => {
      const output = openOutput(mode);
      const win = lastWindow();
      output.prepare(WINDOW_BOUNDS, 'window');
      expect(win.setContentBounds).toHaveBeenLastCalledWith(WINDOW_BOUNDS);
      expect(win.setAspectRatio).toHaveBeenLastCalledWith(16 / 9);
      output.showWindowed(WINDOW_BOUNDS);
      expect(win.setContentBounds).toHaveBeenLastCalledWith(WINDOW_BOUNDS);
      expect(win.setAspectRatio).toHaveBeenLastCalledWith(16 / 9);
      output.showCapture(MONITOR);
      expect(win.setAspectRatio).toHaveBeenLastCalledWith(0);
      output.showWindowed(WINDOW_BOUNDS);
      output.showFullScreen(MONITOR, false);
      expect(win.setAspectRatio).toHaveBeenLastCalledWith(0);
      output.prepare(MONITOR, 'capture');
      expect(win.setAspectRatio).toHaveBeenLastCalledWith(0);
      output.prepare(MONITOR, 'fullscreen');
      expect(win.setAspectRatio).toHaveBeenLastCalledWith(0);
    },
  );

  it.skipIf(process.platform !== 'win32')(
    'prepares the first Windows fullscreen surface before painting and does not resize on reveal',
    () => {
      const output = openOutput('normal');
      const win = lastWindow();
      let full = false;
      let bounds = win.getContentBounds();
      win.setContentBounds.mockImplementation(next => {
        bounds = next;
      });
      win.getContentBounds.mockImplementation(() => bounds);
      win.getBounds.mockImplementation(() => bounds);
      win.isFullScreen.mockImplementation(() => full);
      win.setFullScreen.mockImplementation((next: boolean) => {
        full = next;
      });
      output.prepare(MONITOR, 'fullscreen');
      expect(win.setFullScreen).toHaveBeenCalledExactlyOnceWith(true);
      expect(win.showInactive).not.toHaveBeenCalled();
      expect(win.show).not.toHaveBeenCalled();
      expect(win.focus).not.toHaveBeenCalled();
      output.requestFrame();
      expect(win.setFullScreen.mock.invocationCallOrder[0]).toBeLessThan(
        win.webContents.capturePage.mock.invocationCallOrder[0] ?? 0,
      );
      output.showFullScreen(MONITOR, false);
      expect(win.setFullScreen).toHaveBeenCalledTimes(1);
      output.hide();
      output.prepare({...MONITOR, x: 4000}, 'fullscreen');
      expect(win.setFullScreen).toHaveBeenCalledTimes(1);
      expect(win.isVisible()).toBe(false);
    },
  );

  it('retries an unavailable hidden compositor without hiding later unexpected errors', async () => {
    const log = mockLog();
    const output = openOutput('normal', mockControl(), log);
    const win = lastWindow();
    win.webContents.capturePage.mockRejectedValue(new Error('UnknownVizError'));
    for (let attempt = 0; attempt < 2; attempt += 1) {
      output.requestFrame();
      await Promise.resolve();
      await Promise.resolve();
    }
    expect(log.error).not.toHaveBeenCalled();
    expect(log.info).toHaveBeenCalledOnce();
    const failure = new Error('Unexpected failure');
    win.webContents.capturePage.mockRejectedValue(failure);
    output.requestFrame();
    await Promise.resolve();
    expect(log.error).toHaveBeenCalledWith(
      'could not prepare a hidden output frame',
      failure,
    );
  });
  it('wakes one compositor capture at a time without presenting the window', async () => {
    const output = openOutput('normal');
    const win = lastWindow();
    let finish: () => void = () => undefined;
    win.webContents.capturePage.mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          finish = resolve;
        }),
    );
    output.requestFrame();
    output.requestFrame();
    expect(win.webContents.capturePage).toHaveBeenCalledExactlyOnceWith({
      x: 0,
      y: 0,
      width: 1,
      height: 1,
    });
    expectNeverPresented(win);
    finish();
    await Promise.resolve();
    await Promise.resolve();
    output.requestFrame();
    expect(win.webContents.capturePage).toHaveBeenCalledTimes(2);
    expectNeverPresented(win);
  });

  it('does not capture an offscreen, visible or destroyed window', () => {
    const offscreen = openOutput('offscreen');
    offscreen.requestFrame();
    expect(lastWindow().webContents.capturePage).not.toHaveBeenCalled();
    const normal = openOutput('normal');
    const win = lastWindow();
    win.visible = true;
    normal.requestFrame();
    win.visible = false;
    win.isDestroyed.mockReturnValue(true);
    normal.requestFrame();
    expect(win.webContents.capturePage).not.toHaveBeenCalled();
  });

  it('releases a failed request for retry and reports failure only once', async () => {
    const log = mockLog();
    const output = openOutput('normal', mockControl(), log);
    const win = lastWindow();
    const error = new Error('No frame available');
    win.webContents.capturePage.mockRejectedValue(error);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      output.requestFrame();
      await Promise.resolve();
      await Promise.resolve();
    }
    expect(win.webContents.capturePage).toHaveBeenCalledTimes(2);
    expect(log.error).toHaveBeenCalledExactlyOnceWith(
      'could not prepare a hidden output frame',
      error,
    );
    expectNeverPresented(win);
  });
});
