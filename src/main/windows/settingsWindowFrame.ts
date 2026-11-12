import {BrowserWindow, screen} from 'electron';
import type {UiZoomRegistration} from '../store/uiZoom';
import type {Logger} from '../log';
import {blockNavigation, loadPage, preloadPath} from './page';
import {reloadAfterCrash} from './crashReload';
import {appIconPath} from './appIcon';
import {
  discardTestFrames,
  windowTestOptions,
  type WindowMode,
} from './testWindows';

export const PREFERENCES_WIDTH = 1040;
export const PREFERENCES_HEIGHT = 800;
const PAGE = {name: 'index', query: {window: 'settings'}} as const;

export interface SettingsWindowFrameOptions {
  readonly control: BrowserWindow;
  readonly zoom: Pick<UiZoomRegistration, 'attachControl'>;
  readonly mode: WindowMode;
  readonly log: Logger;
}

/** Fits the fixed preferences dialog to its control window's monitor. */
export function preferencesBounds(control: BrowserWindow) {
  const area = screen.getDisplayMatching(control.getBounds()).workArea;
  const width = Math.min(area.width, PREFERENCES_WIDTH);
  const height = Math.min(area.height, PREFERENCES_HEIGHT);
  return {
    width,
    height,
    x: Math.round(area.x + (area.width - width) / 2),
    y: Math.round(area.y + (area.height - height) / 2),
  };
}

/** Creates the hidden, parented settings frame without showing incomplete content. */
export function createPreferencesWindow({
  control,
  zoom,
  mode,
  log,
}: SettingsWindowFrameOptions): BrowserWindow {
  const bounds = preferencesBounds(control);
  const {webPreferences, ...testOptions} = windowTestOptions(mode);
  // NOTE(0913vision): Even a hidden full-size native view can retain raster and
  // swapchain images. Keep its display area empty until a request is accepted.
  const created = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: 0,
    height: 0,
    minWidth: 0,
    minHeight: 0,
    resizable: false,
    maximizable: false,
    title: '환경설정',
    frame: false,
    icon: appIconPath,
    show: false,
    opacity: 0,
    paintWhenInitiallyHidden: false,
    parent: control,
    skipTaskbar: true,
    backgroundColor: '#0e0e0e',
    ...testOptions,
    webPreferences: {
      preload: preloadPath,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      backgroundThrottling: true,
      ...webPreferences,
    },
  });
  created.removeMenu();
  created.contentView.setVisible(false);
  // NOTE(0913vision): Offscreen rendering has its own frame pump, independent
  // of the initially-hidden native-window flag. Start it only on an open.
  if (mode === 'offscreen') created.webContents.stopPainting();
  created.webContents.setAudioMuted(true);
  discardTestFrames(created.webContents, mode);
  zoom.attachControl(created.webContents);
  blockNavigation(created);
  reloadAfterCrash({win: created, page: PAGE, label: 'settings', log});
  loadPage(created, PAGE, log);
  return created;
}
