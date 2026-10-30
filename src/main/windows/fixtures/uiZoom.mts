import {equal, ok} from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {isAbsolute, join} from 'node:path';
import {app, BrowserWindow, Menu} from 'electron';
import {parseAppConfig} from '@core/schema/appConfig';
import type {Logger} from '../../log';
import {openAppConfig, type AppConfigFile} from '../../store/appConfigFile';
import {registerUiZoom, type UiZoomRegistration} from '../../store/uiZoom';
import {createControlWindow} from '../control';

const STARTUP_DEADLINE_MS = 120_000;
const CHECK_DEADLINE_MS = 30_000;
const POLL_MS = 10;
let timer: ReturnType<typeof setTimeout>;
let zoom: UiZoomRegistration | null = null;
let config: AppConfigFile | null = null;
let exiting = false;

function finish(code: number, error?: unknown): void {
  if (exiting) return;
  exiting = true;
  clearTimeout(timer);
  if (error !== undefined) console.error('UI zoom regression failed:', error);
  try {
    zoom?.dispose();
    config?.dispose();
    for (const win of BrowserWindow.getAllWindows()) win.destroy();
  } finally {
    app.exit(code);
  }
}

process.on('uncaughtException', error => finish(1, error));
process.on('unhandledRejection', error => finish(1, error));
app.on('window-all-closed', () => undefined);
timer = setTimeout(
  () => finish(1, new Error('UI zoom startup timed out')),
  STARTUP_DEADLINE_MS,
);
const [userData] = process.argv.slice(2);
if (
  process.env['LLP_TEST_WINDOWS'] !== 'offscreen' ||
  userData === undefined ||
  !isAbsolute(userData)
) {
  finish(1, new Error('Expected offscreen mode and isolated user data'));
} else {
  app.setPath('userData', userData);
  run(userData).then(
    () => finish(0),
    (error: unknown) => finish(1, error),
  );
}

async function waitFor(
  win: BrowserWindow,
  script: string,
  expected: unknown,
): Promise<void> {
  for (;;) {
    const value: unknown = await win.webContents.executeJavaScript(script);
    if (value === expected) return;
    await new Promise(resolve => setTimeout(resolve, POLL_MS));
  }
}

function key(win: BrowserWindow, keyCode: string): void {
  win.webContents.sendInputEvent({
    type: 'keyDown',
    keyCode,
    modifiers: ['control'],
  });
  win.webContents.sendInputEvent({
    type: 'keyUp',
    keyCode,
    modifiers: ['control'],
  });
}

async function settle(win: BrowserWindow): Promise<void> {
  await win.webContents.executeJavaScript(
    'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))',
  );
}

async function expectZoom(
  win: BrowserWindow,
  owner: AppConfigFile,
  phase: string,
): Promise<void> {
  await owner.flush();
  const stored: unknown = await win.webContents.executeJavaScript(
    'window.llp.ui.getZoom()',
  );
  const parsed = parseAppConfig(await readFile(owner.file, 'utf8'), owner.file);
  if (!parsed.ok) throw new Error(parsed.error.message);
  const actual = {
    factor: win.webContents.getZoomFactor(),
    stored,
    disk: parsed.value.data.uiZoomPercent,
  };
  console.log(JSON.stringify({phase, ...actual}));
  equal(actual.factor, 1, `${phase}: native factor`);
  equal(actual.stored, 100, `${phase}: IPC value`);
  equal(actual.disk, 100, `${phase}: file value`);
  equal(win.isVisible(), false);
}

async function run(userData: string): Promise<void> {
  await app.whenReady();
  const file = join(userData, 'app.json');
  await writeFile(
    file,
    JSON.stringify({format: 'llapp', schemaVersion: 1, uiZoomPercent: 100}),
  );
  const log: Logger = {
    info: () => undefined,
    warn: (...values) => console.warn(...values),
    error: (...values) => console.error(...values),
    flush: () => Promise.resolve(),
  };
  const owner = await openAppConfig({file, log});
  config = owner;
  const registration = registerUiZoom(owner, log);
  zoom = registration;
  const menu = Menu.buildFromTemplate([
    {
      label: '보기',
      submenu: [{role: 'zoomIn'}, {role: 'zoomOut'}, {role: 'resetZoom'}],
    },
  ]);
  Menu.setApplicationMenu(menu);
  ok(
    menu.items[0]?.submenu?.items.some(
      item => item.role?.toLowerCase() === 'zoomout',
    ),
  );
  const win = createControlWindow(log, 'offscreen', registration);
  win.webContents.setBackgroundThrottling(false);
  await waitFor(win, 'document.body.dataset.ready', 'true');
  clearTimeout(timer);
  timer = setTimeout(
    () => finish(1, new Error('UI zoom checks timed out')),
    CHECK_DEADLINE_MS,
  );
  await expectZoom(win, owner, 'initial');

  await win.webContents.executeJavaScript(`(() => {
    const field = document.getElementById('field');
    field.focus();
    field.dispatchEvent(new CompositionEvent('compositionstart', {bubbles: true}));
  })()`);
  key(win, '-');
  await settle(win);
  await expectZoom(win, owner, 'composition Ctrl Minus');
  equal(
    await win.webContents.executeJavaScript(
      'document.body.dataset.keyPrevented',
    ),
    'false',
  );
  key(win, '=');
  await settle(win);
  await expectZoom(win, owner, 'composition Ctrl Equal');
  await win.webContents.executeJavaScript(
    "document.getElementById('field').dispatchEvent(new CompositionEvent('compositionend', {bubbles: true}))",
  );

  win.webContents.setZoomFactor(0.8);
  equal(owner.uiZoomPercent, 100);
  key(win, '0');
  await settle(win);
  await expectZoom(win, owner, 'reset native drift with stored 100');
  key(win, '-');
  await settle(win);
  await expectZoom(win, owner, 'lower clamp');
  console.log('UI zoom Electron regression passed');
}
