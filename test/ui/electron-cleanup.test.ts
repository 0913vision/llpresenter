import {expect, it} from 'vitest';
import {isRunning} from '../process-trees';
import {offscreenApp} from './electron-app';

it(
  'ends Electron and its renderers when the app refuses to quit',
  {timeout: 240_000},
  async () => {
    const fixture = await offscreenApp();
    await fixture.start();
    const application = fixture.electron();
    const pid = application.process().pid;
    if (pid === undefined) throw new Error('Electron process has no pid');
    const renderers = await application.evaluate(({app, BrowserWindow}) => {
      app.on('before-quit', event => event.preventDefault());
      return BrowserWindow.getAllWindows()
        .map(window => window.webContents.getOSProcessId())
        .filter(id => id > 0);
    });
    expect(renderers.length).toBeGreaterThan(0);
    expect(await fixture.stop()).toBe(true);
    await expect.poll(() => isRunning(pid), {timeout: 10_000}).toBe(false);
    for (const renderer of renderers) {
      await expect
        .poll(() => isRunning(renderer), {timeout: 10_000})
        .toBe(false);
    }
  },
);
