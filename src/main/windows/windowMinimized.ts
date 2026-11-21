import type {BrowserWindow} from 'electron';
import {windowEndpoints} from '@contracts/ipc/window';

/** Sends native minimize and restore changes to the owning renderer. */
export function watchWindowMinimized(win: BrowserWindow): void {
  const send = (minimized: boolean): void => {
    if (win.isDestroyed() || win.webContents.isDestroyed()) return;
    win.webContents.send(windowEndpoints.minimizedChanged.channel, minimized);
  };
  win.on('minimize', () => send(true));
  win.on('restore', () => send(false));
}
