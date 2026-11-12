import {app, BrowserWindow, screen} from 'electron';
import {windowEndpoints} from '@contracts/ipc/window';
import type {Logger} from '../log';
import type {UiZoomRegistration} from '../store/uiZoom';
import {audioMutedByDefault} from './audioPolicy';
import {appIconPath} from './appIcon';
import {reloadAfterCrash} from './crashReload';
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

/**
 * Creates the control window without the Windows title bar; the app's menu
 * bar acts as one. In `offscreen` mode it loads and draws but never shows.
 */
export function createControlWindow(
  log: Logger,
  mode: WindowMode,
  zoom: Pick<UiZoomRegistration, 'attachControl'>,
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
      ...testPreferences,
    },
  });
  // NOTE(0913vision): Frameless windows retain native menu accelerators,
  // whose zoom roles would bypass the renderer's IME and shortcut rules.
  win.webContents.setAudioMuted(
    mode === 'offscreen' || audioMutedByDefault(process.env, app.isPackaged),
  );
  win.removeMenu();
  const sendFullScreen = (on: boolean): void => {
    if (win.isDestroyed() || win.webContents.isDestroyed()) return;
    win.webContents.send(windowEndpoints.fullScreenChanged.channel, on);
  };
  win.on('enter-full-screen', () => sendFullScreen(true));
  win.on('leave-full-screen', () => sendFullScreen(false));
  discardTestFrames(win.webContents, mode);
  zoom.attachControl(win.webContents);
  blockNavigation(win);
  // NOTE(0913vision): The main process keeps the live state, so reloading the
  // control window loses nothing on output.
  reloadAfterCrash({win, page: CONTROL_PAGE, label: 'control', log});
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
