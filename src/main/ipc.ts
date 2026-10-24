import {BrowserWindow, ipcMain, type IpcMainEvent} from 'electron';
import {Channels, windowActions, type WindowAction} from '@shared/ipc';
import type {LiveState} from '@shared/live';
import {parseLiveCommand} from '@shared/schema/liveCommand';
import type {Logger} from './log';
import type {LiveStore} from './live/store';
import {handleLogWrite, type MessageHandler} from './rendererMessages';

function isWindowAction(value: unknown): value is WindowAction {
  return windowActions.some(action => action === value);
}

function broadcast(state: LiveState, log: Logger): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed() || win.webContents.isDestroyed()) continue;
    try {
      win.webContents.send(Channels.liveChanged, state);
    } catch (error) {
      log.warn('could not send the live state to a window', error);
    }
  }
}

function controlWindow(event: IpcMainEvent, value: unknown): void {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win === null || !isWindowAction(value)) return;
  switch (value) {
    case 'minimize':
      win.minimize();
      return;
    case 'toggle-maximize':
      if (win.isMaximized()) win.unmaximize();
      else win.maximize();
      return;
    case 'close':
      win.close();
      return;
  }
}

/**
 * Passes every value sent on a fire-and-forget channel to the handler, which
 * validates it.
 *
 * @returns A function that stops listening.
 */
export function listenToWindows(
  channel: string,
  handler: MessageHandler,
): () => void {
  const listener = (_event: IpcMainEvent, value: unknown): void =>
    handler(value);
  ipcMain.on(channel, listener);
  return () => {
    ipcMain.removeListener(channel, listener);
  };
}

/**
 * Registers the IPC channels. Every incoming value is validated; invalid
 * values are logged and dropped.
 *
 * @returns A function that removes everything this registered.
 */
export function registerIpc(store: LiveStore, log: Logger): () => void {
  ipcMain.handle(Channels.liveGet, () => store.state);
  ipcMain.on(Channels.liveCommand, (_event, value: unknown) => {
    const command = parseLiveCommand(value);
    if (!command.ok) {
      log.warn('dropped a malformed command', command.error);
      return;
    }
    store.dispatch(command.value, error =>
      log.error('live state listener failed', error),
    );
  });
  ipcMain.on(Channels.windowControl, controlWindow);
  const stopLogWrites = listenToWindows(Channels.logWrite, handleLogWrite(log));
  const unsubscribe = store.subscribe(state => broadcast(state, log));

  return () => {
    unsubscribe();
    stopLogWrites();
    ipcMain.removeHandler(Channels.liveGet);
    ipcMain.removeAllListeners(Channels.liveCommand);
    ipcMain.removeAllListeners(Channels.windowControl);
  };
}
