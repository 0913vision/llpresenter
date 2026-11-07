import {app, BrowserWindow, ipcMain, screen, type IpcMainEvent} from 'electron';
import {
  windowEndpoints,
  PREFERENCES_REQUEST_LIMIT,
  type PreferencesRequest,
} from '@contracts/ipc/window';
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
const WARMUP_DELAY_MS = 1000;

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
    parent: control,
    skipTaskbar: true,
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
  let stopping = false;
  let wanted = false;
  let rendered = false;
  let opener: BrowserWindow | null = null;
  let warmup: ReturnType<typeof setTimeout> | undefined;
  let requested: PreferencePageId | null = null;
  let request: PreferencesRequest = {requestId: 0, page: 'general'};
  const reveal = (): void => {
    if (!wanted || !rendered || mode === 'offscreen' || win === null) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  };
  const hide = (): void => {
    if (win === null || win.isDestroyed()) return;
    win.hide();
    if (wanted && mode === 'normal' && !opener?.isDestroyed()) opener?.focus();
    wanted = false;
  };
  const scheduleWarmup = (): void => {
    clearTimeout(warmup);
    if (disposed || stopping || control.isDestroyed()) return;
    warmup = setTimeout(() => {
      warmup = undefined;
      prepare();
    }, WARMUP_DELAY_MS);
  };
  const prepare = (): void => {
    if (disposed || stopping || control.isDestroyed()) return;
    if (win !== null && !win.isDestroyed()) return;
    clearTimeout(warmup);
    rendered = false;
    const created = createPreferencesWindow(options);
    win = created;
    const handshake = registerControlClose({
      control: created,
      log,
      beforeClose: hide,
    });
    closing = handshake;
    created.webContents.on('did-start-loading', () => {
      rendered = false;
      requested = request.page;
    });
    created.webContents.on('render-process-gone', (_event, details) => {
      if (created.isDestroyed() || details.reason === 'clean-exit') return;
      rendered = false;
      request = {
        ...request,
        requestId: (request.requestId + 1) % PREFERENCES_REQUEST_LIMIT,
      };
      requested = request.page;
    });
    created.once('closed', () => {
      handshake.dispose();
      win = null;
      closing = undefined;
      requested = null;
      request = {
        requestId: (request.requestId + 1) % PREFERENCES_REQUEST_LIMIT,
        page: 'general',
      };
      if (control.isDestroyed()) app.quit();
      else scheduleWarmup();
    });
  };
  const open = (): void => {
    if (disposed || stopping) return;
    if (!wanted) {
      opener =
        mode === 'normal'
          ? (BrowserWindow.getFocusedWindow() ?? control)
          : null;
    }
    wanted = true;
    prepare();
    reveal();
  };
  const ready = (event: IpcMainEvent, value: unknown): void => {
    if (event.sender.id !== win?.webContents.id) return;
    const parsed = windowEndpoints.preferencesReady.message(value);
    if (
      !parsed.ok ||
      parsed.value.requestId !== request.requestId ||
      parsed.value.page !== request.page
    ) {
      return;
    }
    rendered = true;
    reveal();
  };
  const openAt = (_event: unknown, value: unknown): void => {
    const page = windowEndpoints.openPreferencesAt.message(value);
    if (!page.ok) {
      log.warn('dropped a malformed preferences page request', page.error);
      return;
    }
    if (disposed) return;
    requested = page.value;
    request = {
      requestId: (request.requestId + 1) % PREFERENCES_REQUEST_LIMIT,
      page: page.value,
    };
    const existing = win !== null && !win.isDestroyed() ? win : null;
    if (existing !== null) rendered = existing.isVisible();
    open();
    existing?.webContents.send(
      windowEndpoints.showPreferencesPage.channel,
      page.value,
    );
  };
  ipcMain.on(channel, open);
  ipcMain.on(windowEndpoints.preferencesReady.channel, ready);
  ipcMain.handle(windowEndpoints.preferencesRequest.channel, () => request);
  ipcMain.on(windowEndpoints.openPreferencesAt.channel, openAt);
  // NOTE(0913vision): Each renderer load replays the current request. Consuming
  // its start page must not change the page recovered after a renderer crash.
  ipcMain.handle(windowEndpoints.preferencesPage.channel, () => {
    const page = requested;
    requested = null;
    return page;
  });
  const close = async (): Promise<boolean> => {
    const current = win;
    if (current === null || current.isDestroyed()) return true;
    if (!(await closing?.confirmClose())) return false;
    if (!current.isDestroyed()) {
      hide();
      current.destroy();
    }
    return true;
  };
  const closeAfterControl = (): void => {
    stopping = true;
    clearTimeout(warmup);
    close().catch((error: unknown) =>
      log.error('could not close the preferences window', error),
    );
  };
  control.once('closed', closeAfterControl);
  control.webContents.once('did-finish-load', scheduleWarmup);
  if (!control.webContents.isLoadingMainFrame()) scheduleWarmup();
  return {
    close,
    dispose: async () => {
      if (disposed) return;
      stopping = true;
      clearTimeout(warmup);
      if (!(await close())) {
        stopping = false;
        return;
      }
      disposed = true;
      ipcMain.removeListener(channel, open);
      ipcMain.removeListener(windowEndpoints.preferencesReady.channel, ready);
      ipcMain.removeHandler(windowEndpoints.preferencesRequest.channel);
      ipcMain.removeListener(windowEndpoints.openPreferencesAt.channel, openAt);
      ipcMain.removeHandler(windowEndpoints.preferencesPage.channel);
      control.removeListener('closed', closeAfterControl);
      control.webContents.removeListener('did-finish-load', scheduleWarmup);
    },
  };
}
