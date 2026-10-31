import {BrowserWindow, ipcMain, screen} from 'electron';
import {windowEndpoints} from '@contracts/ipc/window';
import type {AppConfigFile} from '../store/appConfigFile';
import type {UiZoomRegistration} from '../store/uiZoom';
import type {Logger} from '../log';
import {blockNavigation, loadPage, preloadPath} from './page';
import {
  discardTestFrames,
  windowTestOptions,
  type WindowMode,
} from './testWindows';

const MIN_WIDTH = 1280;
const MIN_HEIGHT = 720;
const DEFAULT_WIDTH = 1600;
const DEFAULT_HEIGHT = 900;
const PAGE = {name: 'index', query: {window: 'screens'}} as const;

interface ScreensWindowOptions {
  readonly control: BrowserWindow;
  readonly config: Pick<AppConfigFile, 'screensWindow' | 'setScreensWindow'>;
  readonly zoom: Pick<UiZoomRegistration, 'attachControl'>;
  readonly mode: WindowMode;
  readonly log: Logger;
}

function rememberWindow(
  win: BrowserWindow,
  {config, mode}: Pick<ScreensWindowOptions, 'config' | 'mode'>,
): void {
  if (mode === 'offscreen' || win.isDestroyed()) return;
  config.setScreensWindow({
    ...win.getNormalBounds(),
    maximized: win.isMaximized(),
  });
}

function createScreensWindow({
  config,
  zoom,
  mode,
  log,
}: ScreensWindowOptions): BrowserWindow {
  const saved = config.screensWindow;
  const area = (
    saved === undefined
      ? screen.getPrimaryDisplay()
      : screen.getDisplayMatching(saved)
  ).workArea;
  const width = Math.min(
    area.width,
    Math.max(MIN_WIDTH, saved?.width ?? DEFAULT_WIDTH),
  );
  const height = Math.min(
    area.height,
    Math.max(MIN_HEIGHT, saved?.height ?? DEFAULT_HEIGHT),
  );
  const {webPreferences, ...testOptions} = windowTestOptions(mode);
  const created = new BrowserWindow({
    width,
    height,
    x: Math.max(
      area.x,
      Math.min(
        saved?.x ?? Math.round(area.x + (area.width - width) / 2),
        area.x + area.width - width,
      ),
    ),
    y: Math.max(
      area.y,
      Math.min(
        saved?.y ?? Math.round(area.y + (area.height - height) / 2),
        area.y + area.height - height,
      ),
    ),
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    title: '화면 설정',
    frame: false,
    show: false,
    backgroundColor: '#0e0e0e',
    ...testOptions,
    webPreferences: {
      preload: preloadPath,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      ...webPreferences,
    },
  });
  const remember = (): void => rememberWindow(created, {config, mode});
  created.on('move', remember);
  created.on('resize', remember);
  created.on('close', remember);
  created.removeMenu();
  created.webContents.setAudioMuted(true);
  discardTestFrames(created.webContents, mode);
  zoom.attachControl(created.webContents);
  blockNavigation(created);
  created.once('ready-to-show', () => {
    if (mode === 'offscreen') return;
    if (saved?.maximized === true) created.maximize();
    created.show();
  });
  created.webContents.on('render-process-gone', (_event, details) => {
    log.error('screens window process gone', details);
    if (details.reason !== 'clean-exit' && !created.isDestroyed()) {
      loadPage(created, PAGE, log);
    }
  });
  loadPage(created, PAGE, log);
  return created;
}

/** Owns one screen configuration window and releases its IPC and window on stop. */
export function registerScreensWindow({
  control,
  config,
  zoom,
  mode,
  log,
}: ScreensWindowOptions): () => void {
  let win: BrowserWindow | null = null;
  const open = (): void => {
    if (win !== null && !win.isDestroyed()) {
      if (mode === 'normal') {
        if (win.isMinimized()) win.restore();
        win.focus();
      }
      return;
    }
    const created = createScreensWindow({control, config, zoom, mode, log});
    win = created;
    created.once('closed', () => {
      win = null;
    });
  };
  ipcMain.on(windowEndpoints.openScreens.channel, open);
  const close = (): void => {
    if (win === null || win.isDestroyed()) return;
    rememberWindow(win, {config, mode});
    win.destroy();
    win = null;
  };
  control.once('closed', close);
  return () => {
    ipcMain.removeListener(windowEndpoints.openScreens.channel, open);
    control.removeListener('closed', close);
    close();
  };
}
