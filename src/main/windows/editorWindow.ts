import {BrowserWindow} from 'electron';
import type {UiZoomRegistration} from '../store/uiZoom';
import type {Logger} from '../log';
import {blockNavigation, loadPage, preloadPath, type PageRequest} from './page';
import {
  discardTestFrames,
  windowTestOptions,
  type WindowMode,
} from './testWindows';
import type {Rect} from './orderEditorPlacement';

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
  created.webContents.on('render-process-gone', (_event, details) => {
    log.error(`${title} window process gone`, details);
    if (details.reason !== 'clean-exit' && !created.isDestroyed()) {
      loadPage(created, page, log);
    }
  });
  loadPage(created, page, log);
  return created;
}
