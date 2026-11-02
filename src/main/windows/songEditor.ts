import {app, BrowserWindow, ipcMain, screen} from 'electron';
import {songEditorWindowEndpoints} from '@contracts/ipc/songEditorWindow';
import {windowEndpoints} from '@contracts/ipc/window';
import type {
  OpenWindowResult,
  SongEditorTarget,
} from '@core/schema/ipcPayloads';
import type {AppConfigFile} from '../store/appConfigFile';
import type {UiZoomRegistration} from '../store/uiZoom';
import type {Logger} from '../log';
import {blockNavigation, loadPage, preloadPath} from './page';
import {registerControlClose, type ControlClose} from './controlClose';
import {
  discardTestFrames,
  windowTestOptions,
  type WindowMode,
} from './testWindows';

const MIN_WIDTH = 960;
const MIN_HEIGHT = 600;
const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 820;
const PAGE = {name: 'index', query: {window: 'song'}} as const;

interface SongEditorWindowOptions {
  readonly control: BrowserWindow;
  readonly config: Pick<
    AppConfigFile,
    'songEditorWindow' | 'setSongEditorWindow'
  >;
  readonly zoom: Pick<UiZoomRegistration, 'attachControl'>;
  readonly mode: WindowMode;
  readonly log: Logger;
  /** Whether the 라이브러리 has this song. */
  readonly hasSong: (songId: string) => Promise<boolean>;
}

export interface SongEditorWindowRegistration {
  readonly close: () => Promise<boolean>;
  readonly dispose: () => Promise<void>;
}

function rememberWindow(
  win: BrowserWindow,
  {config, mode}: Pick<SongEditorWindowOptions, 'config' | 'mode'>,
): void {
  if (mode === 'offscreen' || win.isDestroyed()) return;
  config.setSongEditorWindow({
    ...win.getNormalBounds(),
    maximized: win.isMaximized(),
  });
}

function createSongEditorWindow({
  config,
  zoom,
  mode,
  log,
}: SongEditorWindowOptions): BrowserWindow {
  const saved = config.songEditorWindow;
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
    title: '곡 편집',
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
    log.error('song editor window process gone', details);
    if (details.reason !== 'clean-exit' && !created.isDestroyed()) {
      loadPage(created, PAGE, log);
    }
  });
  loadPage(created, PAGE, log);
  return created;
}

/**
 * Owns the one 곡 편집 window: opening again moves it to the new song, and it
 * releases its IPC and window on stop.
 */
export function registerSongEditorWindow(
  options: SongEditorWindowOptions,
): SongEditorWindowRegistration {
  const {control, config, mode, log, hasSong} = options;
  let win: BrowserWindow | null = null;
  let closing: ControlClose | undefined;
  let target: SongEditorTarget | null = null;
  let disposed = false;
  const show = (current: BrowserWindow): void => {
    if (mode !== 'normal') return;
    if (current.isMinimized()) current.restore();
    current.focus();
  };
  const open = async (
    requested: SongEditorTarget,
  ): Promise<OpenWindowResult> => {
    if (disposed) return {ok: false, error: {reason: 'failed'}};
    if (!(await hasSong(requested.songId))) {
      return {ok: false, error: {reason: 'no-such-target'}};
    }
    target = requested;
    if (win !== null && !win.isDestroyed()) {
      win.webContents.send(songEditorWindowEndpoints.retarget.channel, target);
      show(win);
      return {ok: true, value: undefined};
    }
    const created = createSongEditorWindow(options);
    win = created;
    const handshake = registerControlClose({control: created, log});
    closing = handshake;
    created.once('closed', () => {
      handshake.dispose();
      win = null;
      closing = undefined;
      target = null;
      if (control.isDestroyed()) app.quit();
    });
    return {ok: true, value: undefined};
  };
  const openChannel = windowEndpoints.openSongEditor.channel;
  const targetChannel = songEditorWindowEndpoints.target.channel;
  ipcMain.handle(openChannel, (_event, value: unknown) => {
    const parsed = windowEndpoints.openSongEditor.request(value);
    return parsed.ok
      ? open(parsed.value)
      : windowEndpoints.openSongEditor.refuse?.(parsed.error);
  });
  ipcMain.handle(targetChannel, () => target);
  const close = async (): Promise<boolean> => {
    const current = win;
    if (current === null || current.isDestroyed()) return true;
    if (!(await closing?.confirmClose())) return false;
    if (!current.isDestroyed()) {
      rememberWindow(current, {config, mode});
      current.destroy();
    }
    return true;
  };
  const closeAfterControl = (): void => {
    close().catch((error: unknown) =>
      log.error('could not close the song editor window', error),
    );
  };
  control.once('closed', closeAfterControl);
  return {
    close,
    dispose: async () => {
      if (disposed || !(await close())) return;
      disposed = true;
      ipcMain.removeHandler(openChannel);
      ipcMain.removeHandler(targetChannel);
      control.removeListener('closed', closeAfterControl);
    },
  };
}
