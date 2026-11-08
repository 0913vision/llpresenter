import {
  expectNeverPresented,
  lastWindow,
  mockControl,
  mockLog,
  openOutput,
} from '@fixtures/main/outputs/electronWindowFixtures';
import {describe, expect, it} from 'vitest';

describe('hidden output painting', () => {
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
