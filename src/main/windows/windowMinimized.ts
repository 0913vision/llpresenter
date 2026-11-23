import type {BrowserWindow} from 'electron';
import {windowEndpoints} from '@contracts/ipc/window';
import {pushToWindow} from '../base/ipcHost';
import type {Logger} from '../base/log';

/** Tells a window when it is minimized and restored. */
export function watchWindowMinimized(win: BrowserWindow, log: Logger): void {
  const push = (value: boolean): void => {
    if (win.isDestroyed()) return;
    const {minimizedChanged} = windowEndpoints;
    pushToWindow(win.webContents, minimizedChanged, {value, log});
  };
  win.on('minimize', () => push(true));
  win.on('restore', () => push(false));
}
