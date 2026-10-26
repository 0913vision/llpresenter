import {deepEqual, equal, ok} from 'node:assert/strict';
import {isAbsolute} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {app, BrowserWindow, screen} from 'electron';
import {centeredRect, type Rect} from '../../displays/rect';
import type {Logger} from '../../log';
import {watchPixelFixture} from '../../windows/fixtures/pixelFixtureLifecycle.mts';
import {ON_TOP_CHECK_MS, OnTopKeeper} from '../onTopKeeper';
import {
  BOUNDS_RECHECK_MS,
  FULLSCREEN_EXIT_DEADLINE_MS,
  WindowPlacement,
} from '../windowPlacement';

const NATIVE_SETTLE_MS = 100;
const EXIT_WAIT_MS =
  FULLSCREEN_EXIT_DEADLINE_MS + BOUNDS_RECHECK_MS + NATIVE_SETTLE_MS;
let placement: WindowPlacement | null = null;
let onTop: OnTopKeeper | null = null;
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
    onTop?.dispose();
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

async function probeCapture(
  win: BrowserWindow,
  position: WindowPlacement,
  behindControl: () => void,
): Promise<void> {
  await win.loadURL(
    'data:text/html,<body><script>let frames=0;function tick(){document.body.textContent=String(++frames);requestAnimationFrame(tick)}tick()</script>',
  );
  const {x, y} = screen.getPrimaryDisplay().workArea;
  for (const [width, height] of [
    [1920, 1080],
    [1280, 720],
    [3840, 2160],
  ]) {
    if (width === undefined || height === undefined) {
      throw new Error('Invalid capture fixture size');
    }
    const bounds = {x, y, width, height};
    position.windowed(() => {
      win.setMinimizable(false);
      win.setMaximizable(false);
      win.setResizable(false);
      win.setContentBounds(bounds);
      position.verifyContentBounds(bounds, behindControl);
      behindControl();
    });
    await delay(EXIT_WAIT_MS);
    deepEqual(win.getContentBounds(), bounds);
    deepEqual(
      await win.webContents.executeJavaScript('[innerWidth, innerHeight]'),
      [width, height],
    );
    equal(win.isMinimizable(), false);
    const before: unknown = await win.webContents.executeJavaScript(
      'Number(document.body.textContent)',
    );
    const after: unknown = await win.webContents.executeJavaScript(
      'new Promise(resolve=>requestAnimationFrame(()=>resolve(Number(document.body.textContent))))',
    );
    ok(
      typeof before === 'number' && typeof after === 'number' && after > before,
    );
    console.log(`CAPTURE_SIZE ${JSON.stringify(bounds)}`);
  }
  console.log('native capture content and covered frames passed');
}

async function run(): Promise<void> {
  await app.whenReady();
  deadline.checking();
  const monitor = screen.getPrimaryDisplay();
  const control = new BrowserWindow({show: false, focusable: false});
  const win = new BrowserWindow({
    show: false,
    focusable: false,
    webPreferences: {backgroundThrottling: false},
    ...centeredRect(monitor.workArea, {width: 640, height: 360}),
  });
  control.showInactive();
  win.showInactive();
  await probeOrder(win);

  const errors: unknown[] = [];
  const log: Logger = {
    info: () => undefined,
    warn: (message, detail) =>
      console.log(`WARN ${message} ${JSON.stringify(detail)}`),
    error: (message, detail) => errors.push({message, detail}),
    flush: () => Promise.resolve(),
  };
  const started = performance.now();
  const onTopChanges: string[] = [];
  win.on('always-on-top-changed', (_event, value) =>
    onTopChanges.push(`${value}@${Math.round(performance.now() - started)}`),
  );
  placement = new WindowPlacement(win, log);
  const keeper = new OnTopKeeper(win, log);
  onTop = keeper;
  win.setFullScreen(true);
  keeper.set(true);
  await delay(NATIVE_SETTLE_MS);
  ok(win.isFullScreen());
  const target = centeredRect(monitor.workArea, {width: 480, height: 270});
  const behindControl = () => {
    keeper.set(false);
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
    keeper.release();
    win.setFullScreen(true);
    keeper.set(true);
  });
  await delay(ON_TOP_CHECK_MS + NATIVE_SETTLE_MS);
  console.log(`ALWAYS_ON_TOP_CHANGES ${JSON.stringify(onTopChanges)}`);
  ok(win.isFullScreen());
  ok(win.isAlwaysOnTop());
  deepEqual(errors, []);
  console.log('native fullscreen placement passed');
  control.setBounds(monitor.bounds);
  await probeCapture(win, placement, behindControl);
  deepEqual(errors, []);
}
