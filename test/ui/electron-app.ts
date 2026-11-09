import {mkdir, mkdtemp, rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname, join, resolve} from 'node:path';
import {
  _electron as electron,
  type ElectronApplication,
  type Page,
} from 'playwright-core';
import {expect, onTestFinished} from 'vitest';
import {runStepProcess} from '../../scripts/verify/step-process.mts';
import {electronTestArgs} from '@fixtures/electronLaunch';
import {makeTempDir} from '@fixtures/tempDir';
import {stopElectron} from './stop-electron';

const BUILD_TIMEOUT = 120_000;
const START_TIMEOUT = 60_000;
const POLL_TIMEOUT = 30_000;

/** Builds and starts the real app with a private data directory and no visible windows. */
export async function offscreenApp(): Promise<{
  readonly data: string;
  readonly start: () => Promise<Page>;
  readonly stop: () => Promise<boolean>;
  readonly electron: () => ElectronApplication;
}> {
  const data = await makeTempDir();
  const cache = resolve('node_modules/.cache');
  await mkdir(cache, {recursive: true});
  const root = await mkdtemp(join(cache, 'ui-flow-'));
  const require = createRequire(import.meta.url);
  const vitePackage = require.resolve('electron-vite/package.json');
  const viteCli = join(dirname(vitePackage), 'bin', 'electron-vite.js');
  const main = join(root, 'main', 'index.js');
  let app: ElectronApplication | undefined;

  const stop = async (): Promise<boolean> => {
    if (app === undefined) return false;
    const current = app;
    const forced = await stopElectron(current);
    if (app === current) app = undefined;
    return forced;
  };
  onTestFinished(async () => {
    try {
      await stop();
    } finally {
      await rm(root, {recursive: true, force: true, maxRetries: 5});
    }
  });

  const cleanEnv = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) =>
        ![
          'electron_run_as_node',
          'electron_renderer_url',
          'node_options',
        ].includes(key.toLowerCase()),
    ),
  );
  const run = async (name: string, args: readonly string[]): Promise<void> => {
    const result = await runStepProcess({
      name,
      file: process.execPath,
      args,
      env: cleanEnv,
      deadlineMs: BUILD_TIMEOUT,
      interrupt: new AbortController().signal,
    });
    expect(result.leftRunning, result.output).toBe(false);
    expect(result.exitCode, result.output).toBe(0);
  };
  await run('UI flow build', [viteCli, 'build', '--outDir', root]);
  await run('UI flow syntax', ['--check', main]);

  const start = async (): Promise<Page> => {
    if (app !== undefined) throw new Error('The test app is already running');
    const binary: unknown = require('electron');
    if (typeof binary !== 'string') throw new Error('Expected Electron binary');
    const began = performance.now();
    const current = await electron.launch({
      executablePath: binary,
      args: electronTestArgs([main], cleanEnv),
      env: {...cleanEnv, LLP_USER_DATA: data, LLP_TEST_WINDOWS: 'offscreen'},
      timeout: START_TIMEOUT,
    });
    app = current;
    const launched = performance.now();
    await expect
      .poll(
        () =>
          current
            .windows()
            .some(window => window.url().endsWith('/index.html')),
        {timeout: POLL_TIMEOUT},
      )
      .toBe(true);
    const page = current
      .windows()
      .find(window => window.url().endsWith('/index.html'));
    if (page === undefined) throw new Error('Control window not found');
    const windowed = performance.now();
    // NOTE(0913vision): The window exists before React has mounted, so wait for
    // the menu bar, the first thing every control window draws. A test that
    // starts the control window in another state, such as a recovery or error
    // screen, must not use this `start()` unchanged.
    await page
      .locator('[role="menubar"]')
      .waitFor({state: 'attached', timeout: POLL_TIMEOUT});
    const mounted = performance.now();
    console.info(
      `ui start: launch ${Math.round(launched - began)} ms, window ${Math.round(windowed - launched)} ms, menu bar ${Math.round(mounted - windowed)} ms`,
    );
    expect(
      await current.evaluate(({BrowserWindow}) =>
        BrowserWindow.getAllWindows().every(window => !window.isVisible()),
      ),
    ).toBe(true);
    return page;
  };
  const application = (): ElectronApplication => {
    if (app === undefined) throw new Error('The test app is not running');
    return app;
  };
  return {data, start, stop, electron: application};
}
