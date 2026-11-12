import {BrowserWindow} from 'electron';
import type {UiZoomRegistration} from '../store/uiZoom';
import type {Logger} from '../log';
import {blockNavigation, loadPage, preloadPath, type PageRequest} from './page';
import {reloadAfterCrash} from './crashReload';
import {appIconPath} from './appIcon';
import {
  discardTestFrames,
  windowTestOptions,
  type WindowMode,
} from './testWindows';
interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const BACKGROUND_COLOR = '#0e0e0e';

/** What a tool window needs to open: its page, title, place, and size limits. */
export interface EditorWindowOptions {
  readonly page: PageRequest;
  readonly title: string;
  readonly bounds: Rect;
  readonly minWidth: number;
  readonly minHeight: number;
  readonly maximized: boolean;
  readonly zoom: Pick<UiZoomRegistration, 'attachControl'>;
  readonly mode: WindowMode;
  readonly log: Logger;
}

/**
 * Creates a frameless tool window on one of the control page's routes. It
 * shows when its page is ready, reloads its page when the renderer process
 * dies, and never shows in an offscreen test run.
 */
export function createEditorWindow({
  page,
  title,
  bounds,
  minWidth,
  minHeight,
  maximized,
  zoom,
  mode,
  log,
}: EditorWindowOptions): BrowserWindow {
  const {webPreferences, ...testOptions} = windowTestOptions(mode);
  const created = new BrowserWindow({
    ...bounds,
    minWidth,
    minHeight,
    title,
    icon: appIconPath,
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
    if (maximized) created.maximize();
    created.show();
  });
  reloadAfterCrash({win: created, page: page, label: title, log});
  loadPage(created, page, log);
  return created;
}
