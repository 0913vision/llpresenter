import {BrowserWindow, screen} from 'electron';
import type {Logger} from '../log';
import {blockNavigation, loadPage, preloadPath, type PageRequest} from './page';
import {
  discardTestFrames,
  windowTestOptions,
  type WindowMode,
} from './testWindows';

const MIN_WIDTH = 1280;
const MIN_HEIGHT = 720;
const DEFAULT_WIDTH = 1920;
const DEFAULT_HEIGHT = 1080;
const BACKGROUND = '#0e0e0e';
const CONTROL_PAGE: PageRequest = {name: 'index'};

function reloadAfterCrash(win: BrowserWindow, log: Logger): void {
  // NOTE(0913vision): The main process keeps the live state, so reloading the
  // control window loses nothing on output.
  win.webContents.on('render-process-gone', (_event, details) => {
    log.error('control window process gone', details);
    if (details.reason !== 'clean-exit' && !win.isDestroyed()) {
      loadPage(win, CONTROL_PAGE, log);
    }
  });
}

/**
 * Creates the control window without the Windows title bar; the app's menu
 * bar acts as one. In `offscreen` mode it loads and draws but never shows.
 */
export function createControlWindow(
  log: Logger,
  mode: WindowMode,
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
    backgroundColor: BACKGROUND,
    ...testOptions,
    webPreferences: {
      preload: preloadPath,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      ...testPreferences,
    },
  });
  discardTestFrames(win.webContents, mode);
  blockNavigation(win);
  reloadAfterCrash(win, log);
  win.once('ready-to-show', () => {
    if (mode === 'offscreen') return;
    const fitsScreen =
      area.width <= DEFAULT_WIDTH && area.height <= DEFAULT_HEIGHT;
    if (fitsScreen) win.maximize();
    win.show();
  });
  loadPage(win, CONTROL_PAGE, log);
  return win;
}
