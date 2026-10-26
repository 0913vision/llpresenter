import {BrowserWindow} from 'electron';
import type {Logger} from '../log';
import {blockNavigation, loadPage} from '../windows/page';
import {
  discardTestFrames,
  windowTestOptions,
  type WindowMode,
} from '../windows/testWindows';
import {OUTPUT_BACKGROUND} from './electronWindow';
import type {NumberSpot, NumberWindow} from './monitorNumbers';

const ABOVE_OUTPUTS = 'screen-saver';

/**
 * Opens one 모니터 번호 표시 window: borderless, out of the taskbar, above
 * every output window, never focused, and clicked through, so the operator's
 * input stays in the control window. It shows once its page is ready.
 */
export function openNumberWindow(
  {number, bounds, details}: NumberSpot,
  log: Logger,
  mode: WindowMode = 'normal',
): NumberWindow {
  const testOptions = windowTestOptions(mode);
  const win = new BrowserWindow({
    ...bounds,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    focusable: false,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: OUTPUT_BACKGROUND,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      ...testOptions.webPreferences,
    },
  });
  win.removeMenu();
  discardTestFrames(win.webContents, mode);
  if (mode === 'normal') win.setAlwaysOnTop(true, ABOVE_OUTPUTS);
  win.setIgnoreMouseEvents(true);
  blockNavigation(win);
  win.once('ready-to-show', () => {
    if (mode === 'normal' && !win.isDestroyed()) win.showInactive();
  });
  loadPage(
    win,
    {
      name: 'output',
      query: {
        'monitor-number': String(number),
        ...(details === undefined
          ? {}
          : {'monitor-details': JSON.stringify(details)}),
      },
    },
    log,
  );
  return {
    close: () => {
      if (!win.isDestroyed()) win.destroy();
    },
  };
}
