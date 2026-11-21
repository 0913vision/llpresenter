import {watchWindowMinimized} from './windowMinimized';
import {app, BrowserWindow, ipcMain, screen, type IpcMainEvent} from 'electron';
import {windowEndpoints} from '@contracts/ipc/window';
import {serviceEndpoints} from '@contracts/ipc/service';
import type {Logger} from '../log';
import type {UiZoomRegistration} from '../store/uiZoom';
import {audioMutedByDefault} from './audioPolicy';
import {appIconPath} from './appIcon';
import {reloadAfterCrash} from './crashReload';
import {logWindowResponsiveness} from './responsiveness';
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
  watchWindowMinimized(win);
  win.removeMenu();
  logWindowResponsiveness(win, 'control', log);
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
  if (mode === 'normal') {
    let painted = false;
    let dataReady = false;
    let outputsPrepared = false;
    let shown = false;
    const show = (): void => {
      if (
        shown ||
        !painted ||
        !dataReady ||
        !outputsPrepared ||
        win.isDestroyed()
      ) {
        return;
      }
      shown = true;
      clearTimeout(timeout);
      ipcMain.removeListener(serviceEndpoints.ready.channel, onReady);
      if (zoom.startMaximized ?? true) win.maximize();
      win.show();
    };
    const onReady = (event: IpcMainEvent, ...args: unknown[]): void => {
      if (
        event.sender !== win.webContents ||
        event.senderFrame !== win.webContents.mainFrame ||
        args.length !== 0
      ) {
        return;
      }
      dataReady = true;
      show();
    };
    const timeout = setTimeout(() => {
      dataReady = true;
      outputsPrepared = true;
      show();
    }, STARTUP_TIMEOUT_MS);
    timeout.unref();
    ipcMain.on(serviceEndpoints.ready.channel, onReady);
    (zoom.outputsReady ?? Promise.resolve(true)).then(
      () => {
        outputsPrepared = true;
        show();
      },
      (error: unknown) => {
        log.warn('Could not confirm output readiness', error);
        outputsPrepared = true;
        show();
      },
    );
    win.once('closed', () => {
      clearTimeout(timeout);
      ipcMain.removeListener(serviceEndpoints.ready.channel, onReady);
    });
    win.once('ready-to-show', () => {
      painted = true;
      show();
    });
  }
  loadPage(win, CONTROL_PAGE, log);
  return win;
}
