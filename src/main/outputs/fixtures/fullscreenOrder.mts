import {deepEqual, equal, ok} from 'node:assert/strict';
import {isAbsolute} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {app, BrowserWindow, screen} from 'electron';
import {centeredRect, type Rect} from '../../displays/rect';
import type {Logger} from '../../log';
import {watchPixelFixture} from '../../windows/fixtures/pixelFixtureLifecycle.mts';
import {
  BOUNDS_RECHECK_MS,
  FULLSCREEN_EXIT_DEADLINE_MS,
  WindowPlacement,
} from '../windowPlacement';

const NATIVE_SETTLE_MS = 100;
const EXIT_WAIT_MS =
  FULLSCREEN_EXIT_DEADLINE_MS + BOUNDS_RECHECK_MS + NATIVE_SETTLE_MS;
let placement: WindowPlacement | null = null;
let exiting = false;
const deadline = watchPixelFixture(phase =>
  finish(1, new Error(`native fullscreen ${phase} timed out`)),
);

function finish(code: number, error?: unknown): void {
  if (exiting) return;
  exiting = true;
  deadline.dispose();
  if (error !== undefined) console.error(error);
  try {
    placement?.dispose();
    for (const win of BrowserWindow.getAllWindows()) win.destroy();
  } finally {
    app.exit(code);
  }
}

process.on('uncaughtException', error => finish(1, error));
process.on('unhandledRejection', error => finish(1, error));
app.on('window-all-closed', () => undefined);
const [userData] = process.argv.slice(2);
if (
  process.platform !== 'win32' ||
  process.env['GITHUB_ACTIONS'] !== 'true' ||
  process.env['RUNNER_OS'] !== 'Windows' ||
  process.env['LLP_NATIVE_PLACEMENT_CI'] !== '1' ||
  userData === undefined ||
  !isAbsolute(userData)
) {
  finish(1, new Error('Native fullscreen checks run only on GitHub Windows'));
} else {
  app.setPath('userData', userData);
  run().then(
    () => finish(0),
    (error: unknown) => finish(1, error),
  );
}

async function probeOrder(win: BrowserWindow): Promise<void> {
  win.setFullScreen(true);
  await delay(NATIVE_SETTLE_MS);
  const samples: Array<{phase: string; bounds: Rect}> = [];
  const sample = (phase: string) =>
    samples.push({phase, bounds: win.getBounds()});
  const left = () => sample('leave-full-screen');
  win.on('leave-full-screen', left);
  try {
    sample('before-exit');
    win.setFullScreen(false);
    sample('after-setFullScreen-return');
    await delay(0);
    sample('next-turn');
    await delay(EXIT_WAIT_MS);
    sample('settled');
    console.log(`FULLSCREEN_ORDER ${JSON.stringify(samples)}`);
    equal(win.isFullScreen(), false);
  } finally {
    win.removeListener('leave-full-screen', left);
  }
}

async function run(): Promise<void> {
  await app.whenReady();
  deadline.checking();
  const monitor = screen.getPrimaryDisplay();
  const control = new BrowserWindow({show: false, focusable: false});
  const win = new BrowserWindow({
    show: false,
    focusable: false,
    ...centeredRect(monitor.workArea, {width: 640, height: 360}),
  });
  control.showInactive();
  win.showInactive();
  await probeOrder(win);

  const errors: unknown[] = [];
  const log: Logger = {
    info: () => undefined,
    warn: () => undefined,
    error: (message, detail) => errors.push({message, detail}),
    flush: () => Promise.resolve(),
  };
  placement = new WindowPlacement(win, log);
  win.setFullScreen(true);
  win.setAlwaysOnTop(true);
  await delay(NATIVE_SETTLE_MS);
  ok(win.isFullScreen());
  const target = centeredRect(monitor.workArea, {width: 480, height: 270});
  const behindControl = () => {
    win.setAlwaysOnTop(false);
    control.moveAbove(win.getMediaSourceId());
  };
  behindControl();
  placement.windowed(() => {
    win.setBounds(target);
    behindControl();
    placement?.verifyBounds(target, behindControl);
  });
  await delay(EXIT_WAIT_MS);
  deepEqual(win.getBounds(), target);
  equal(win.isAlwaysOnTop(), false);
  placement.fullscreen(() => {
    win.setFullScreen(true);
    win.setAlwaysOnTop(true);
  });
  await delay(NATIVE_SETTLE_MS);
  ok(win.isFullScreen());
  ok(win.isAlwaysOnTop());
  deepEqual(errors, []);
  console.log('native fullscreen placement passed');
}
