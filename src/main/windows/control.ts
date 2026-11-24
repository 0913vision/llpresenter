import {app, BrowserWindow, screen} from 'electron';
import {windowEndpoints} from '@contracts/ipc/window';
import {launchEndpoints} from '@contracts/ipc/launch';
import {IpcHost, pushToWindow} from '../base/ipcHost';
import type {Logger} from '../base/log';
import type {UiZoomRegistration} from '../store/settings/uiZoom';
import {audioMutedByDefault} from '../base/renderers/audioPolicy';
import {appIconPath} from '../base/renderers/appIcon';
import {logWindowResponsiveness} from '../base/renderers/responsiveness';
import {
  blockNavigation,
  loadPage,
  preloadPath,
  type PageRequest,
} from '../base/renderers/page';
import {
  discardTestFrames,
  windowTestOptions,
  type WindowMode,
} from '../base/renderers/testWindows';
import {reloadAfterCrash} from './crashReload';
import {watchWindowMinimized} from './windowMinimized';

const MIN_WIDTH = 1280;
const MIN_HEIGHT = 720;
const DEFAULT_WIDTH = 1920;
const DEFAULT_HEIGHT = 1080;
const BACKGROUND = '#0e0e0e';
const STARTUP_TIMEOUT_MS = 15000;
const CONTROL_PAGE: PageRequest = {name: 'index'};

/**
 * Creates the control window without the Windows title bar; the app's menu
 * bar acts as one. In `offscreen` mode it loads and draws but never shows.
 */
export function createControlWindow(
  log: Logger,
  mode: WindowMode,
  zoom: Pick<UiZoomRegistration, 'attachControl'> & {
    readonly outputsReady?: Promise<boolean>;
    readonly startMaximized?: boolean;
    /** Told when the window opens without all it waits for. */
    readonly onOverdue?: () => void;
    /** Told when the window opens; an offscreen one never shows. */
    readonly onOpen?: () => void;
  },
): BrowserWindow {
  const area = screen.getPrimaryDisplay().workAreaSize;
  const {webPreferences: testPreferences, ...testOptions} =
    windowTestOptions(mode);
  const win = new BrowserWindow({
    width: Math.max(MIN_WIDTH, Math.min(DEFAULT_WIDTH, area.width)),
    height: Math.max(MIN_HEIGHT, Math.min(DEFAULT_HEIGHT, area.height)),
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    show: false,
    frame: false,
    title: 'LoveLight Presenter',
    icon: appIconPath,
    backgroundColor: BACKGROUND,
    ...testOptions,
    webPreferences: {
      preload: preloadPath,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      enableBlinkFeatures: 'CanvasDrawElement',
      ...testPreferences,
    },
  });
  // NOTE(0913vision): Frameless windows retain native menu accelerators,
  // whose zoom roles would bypass the renderer's IME and shortcut rules.
  win.webContents.setAudioMuted(
    mode === 'offscreen' || audioMutedByDefault(process.env, app.isPackaged),
  );
  watchWindowMinimized(win, log);
  win.removeMenu();
  logWindowResponsiveness(win, 'control', log);
  watchFullScreen(win, log);
  discardTestFrames(win.webContents, mode);
  zoom.attachControl(win.webContents);
  blockNavigation(win);
  // NOTE(0913vision): The main process keeps the live state, so reloading the
  // control window loses nothing on output.
  reloadAfterCrash({win, page: CONTROL_PAGE, label: 'control', log});
  openWhenReady(win, {
    ...zoom,
    onOpen: () => {
      if (mode === 'normal') show(win, zoom.startMaximized ?? true);
      zoom.onOpen?.();
    },
    log,
  });
  loadPage(win, CONTROL_PAGE, log);
  return win;
}

function watchFullScreen(win: BrowserWindow, log: Logger): void {
  const push = (value: boolean): void => {
    if (win.isDestroyed()) return;
    const {fullScreenChanged} = windowEndpoints;
    pushToWindow(win.webContents, fullScreenChanged, {value, log});
  };
  win.on('enter-full-screen', () => push(true));
  win.on('leave-full-screen', () => push(false));
}

function show(win: BrowserWindow, maximized: boolean): void {
  if (maximized) win.maximize();
  win.show();
}

/**
 * Opens the window once its page has drawn, with its data and the outputs
 * ready. Data and outputs that take too long are not waited for.
 */
function openWhenReady(
  win: BrowserWindow,
  {
    outputsReady = Promise.resolve(true),
    onOverdue = () => undefined,
    onOpen,
    log,
  }: {
    readonly outputsReady?: Promise<boolean>;
    readonly onOverdue?: () => void;
    readonly onOpen: () => void;
    readonly log: Logger;
  },
): void {
  const ipc = new IpcHost(log);
  const missing = new Set(['page', 'data', 'outputs']);
  const ready = (...parts: readonly string[]): void => {
    for (const part of parts) missing.delete(part);
    if (missing.size > 0 || win.isDestroyed()) return;
    clearTimeout(timeout);
    ipc.close();
    onOpen();
  };
  const timeout = setTimeout(() => {
    log.warn('the control window opens without waiting', {
      missing: [...missing],
    });
    onOverdue();
    ready('data', 'outputs');
  }, STARTUP_TIMEOUT_MS);
  timeout.unref();
  ipc.signal(launchEndpoints.ready, ({contents, isMainFrame}) => {
    if (contents === win.webContents && isMainFrame) ready('data');
  });
  outputsReady.then(
    () => ready('outputs'),
    (error: unknown) => {
      log.warn('Could not confirm output readiness', error);
      ready('outputs');
    },
  );
  win.once('closed', () => {
    clearTimeout(timeout);
    ipc.close();
  });
  win.once('ready-to-show', () => ready('page'));
}
