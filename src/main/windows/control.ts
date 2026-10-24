import {BrowserWindow, screen} from 'electron';
import {join} from 'node:path';
import type {Logger} from '../log';

const MIN_WIDTH = 1280;
const MIN_HEIGHT = 720;
const DEFAULT_WIDTH = 1920;
const DEFAULT_HEIGHT = 1080;
const BACKGROUND = '#0e0e0e';

export const preloadPath = join(__dirname, '../preload/index.js');

export function loadPage(win: BrowserWindow, page: 'index'): void {
  const devServer = process.env['ELECTRON_RENDERER_URL'];
  if (devServer !== undefined && devServer.length > 0) {
    void win.loadURL(`${devServer}/${page}.html`);
  } else {
    void win.loadFile(join(__dirname, `../renderer/${page}.html`));
  }
}

function blockNavigation(win: BrowserWindow): void {
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({action: 'deny'}));
}

function reloadAfterCrash(win: BrowserWindow, log: Logger): void {
  // NOTE(0913vision): The main process keeps the live state, so reloading the
  // control window loses nothing on output.
  win.webContents.on('render-process-gone', (_event, details) => {
    log.error('control window process gone', details);
    if (details.reason !== 'clean-exit' && !win.isDestroyed()) {
      loadPage(win, 'index');
    }
  });
}

/** Creates the control window without the Windows title bar; the app's menu bar acts as one. */
export function createControlWindow(log: Logger): BrowserWindow {
  const area = screen.getPrimaryDisplay().workAreaSize;
  const win = new BrowserWindow({
    width: Math.max(MIN_WIDTH, Math.min(DEFAULT_WIDTH, area.width)),
    height: Math.max(MIN_HEIGHT, Math.min(DEFAULT_HEIGHT, area.height)),
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    show: false,
    frame: false,
    title: 'LoveLight Presenter',
    backgroundColor: BACKGROUND,
    webPreferences: {
      preload: preloadPath,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });
  blockNavigation(win);
  reloadAfterCrash(win, log);
  win.once('ready-to-show', () => {
    const fitsScreen =
      area.width <= DEFAULT_WIDTH && area.height <= DEFAULT_HEIGHT;
    if (fitsScreen) win.maximize();
    win.show();
  });
  loadPage(win, 'index');
  return win;
}
