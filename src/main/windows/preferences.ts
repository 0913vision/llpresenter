import {app, BrowserWindow, ipcMain, screen} from 'electron';
import {windowEndpoints} from '@contracts/ipc/window';
import type {PreferencePageId} from '@core/schema/preferencePages';
import type {UiZoomRegistration} from '../store/uiZoom';
import type {Logger} from '../log';
import {registerControlClose, type ControlClose} from './controlClose';
import {blockNavigation, loadPage, preloadPath} from './page';
import {reloadAfterCrash} from './crashReload';
import {
  discardTestFrames,
  windowTestOptions,
  type WindowMode,
} from './testWindows';

export const PREFERENCES_WIDTH = 1040;
export const PREFERENCES_HEIGHT = 800;
const PAGE = {name: 'index', query: {window: 'preferences'}} as const;
const TITLE = '환경설정';
const BACKGROUND_COLOR = '#0e0e0e';

interface PreferencesWindowOptions {
  readonly control: BrowserWindow;
  readonly zoom: Pick<UiZoomRegistration, 'attachControl'>;
  readonly mode: WindowMode;
  readonly log: Logger;
}

export interface PreferencesWindowRegistration {
  readonly close: () => Promise<boolean>;
  readonly dispose: () => Promise<void>;
}

function createPreferencesWindow({
  control,
  zoom,
  mode,
  log,
}: PreferencesWindowOptions): BrowserWindow {
  const area = screen.getDisplayMatching(control.getBounds()).workArea;
  const width = Math.min(area.width, PREFERENCES_WIDTH);
  const height = Math.min(area.height, PREFERENCES_HEIGHT);
  const {webPreferences, ...testOptions} = windowTestOptions(mode);
  const created = new BrowserWindow({
    width,
    height,
    x: Math.round(area.x + (area.width - width) / 2),
    y: Math.round(area.y + (area.height - height) / 2),
    minWidth: width,
    minHeight: height,
    resizable: false,
    maximizable: false,
    title: TITLE,
    frame: false,
    show: false,
    backgroundColor: BACKGROUND_COLOR,
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
  created.removeMenu();
  created.webContents.setAudioMuted(true);
  discardTestFrames(created.webContents, mode);
  zoom.attachControl(created.webContents);
  blockNavigation(created);
  created.once('ready-to-show', () => {
    if (mode === 'offscreen') return;
    created.show();
  });
  reloadAfterCrash({win: created, page: PAGE, label: 'preferences', log});
  loadPage(created, PAGE, log);
  return created;
}

/** Owns the one 환경설정 window and releases its IPC and window on stop. */
export function registerPreferencesWindow(
  options: PreferencesWindowOptions,
): PreferencesWindowRegistration {
  const {control, mode, log} = options;
  const channel = windowEndpoints.openPreferences.channel;
  let win: BrowserWindow | null = null;
  let closing: ControlClose | undefined;
  let disposed = false;
  let requested: PreferencePageId | null = null;
  const open = (): void => {
    if (disposed) return;
    if (win !== null && !win.isDestroyed()) {
      if (mode === 'normal') {
        if (win.isMinimized()) win.restore();
        win.focus();
      }
      return;
    }
    const created = createPreferencesWindow(options);
    win = created;
    const handshake = registerControlClose({control: created, log});
    closing = handshake;
    created.once('closed', () => {
      handshake.dispose();
      win = null;
      closing = undefined;
      requested = null;
      if (control.isDestroyed()) app.quit();
    });
  };
  const openAt = (_event: unknown, value: unknown): void => {
    const page = windowEndpoints.openPreferencesAt.message(value);
    if (!page.ok || disposed) return;
    requested = page.value;
    const existing = win !== null && !win.isDestroyed() ? win : null;
    open();
    existing?.webContents.send(
      windowEndpoints.showPreferencesPage.channel,
      page.value,
    );
  };
  ipcMain.on(channel, open);
  ipcMain.on(windowEndpoints.openPreferencesAt.channel, openAt);
  ipcMain.handle(windowEndpoints.preferencesPage.channel, () => requested);
  const close = async (): Promise<boolean> => {
    const current = win;
    if (current === null || current.isDestroyed()) return true;
    if (!(await closing?.confirmClose())) return false;
    if (!current.isDestroyed()) current.destroy();
    return true;
  };
  const closeAfterControl = (): void => {
    close().catch((error: unknown) =>
      log.error('could not close the preferences window', error),
    );
  };
  control.once('closed', closeAfterControl);
  return {
    close,
    dispose: async () => {
      if (disposed || !(await close())) return;
      disposed = true;
      ipcMain.removeListener(channel, open);
      ipcMain.removeListener(windowEndpoints.openPreferencesAt.channel, openAt);
      ipcMain.removeHandler(windowEndpoints.preferencesPage.channel);
      control.removeListener('closed', closeAfterControl);
    },
  };
}
