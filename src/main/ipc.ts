import {BrowserWindow, ipcMain, type IpcMainEvent} from 'electron';
import {Channels, windowActions, type WindowAction} from '@shared/ipc';
import {parseLiveCommand} from '@shared/schema/liveCommand';
import type {Logger} from './log';
import type {LiveStore} from './live/store';
import {
  WindowLogLimiter,
  handleLogWrite,
  type MessageHandler,
} from './rendererMessages';
import {allowsWindowAction, type WindowMode} from './windows/testWindows';

function isWindowAction(value: unknown): value is WindowAction {
  return windowActions.some(action => action === value);
}

/** Sends a value to every open window on a channel; a window that fails is logged and skipped. */
export function sendToWindows(
  channel: string,
  value: unknown,
  log: Logger,
): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed() || win.webContents.isDestroyed()) continue;
    try {
      win.webContents.send(channel, value);
    } catch (error) {
      log.warn(`could not send ${channel} to a window`, error);
    }
  }
}

/**
 * Answers every `invoke` on a channel with the current value.
 *
 * @returns A function that stops answering.
 */
export function answerWindows(
  channel: string,
  answer: () => unknown,
): () => void {
  ipcMain.handle(channel, answer);
  return () => {
    ipcMain.removeHandler(channel);
  };
}

function runWindowAction(win: BrowserWindow, action: WindowAction): void {
  switch (action) {
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

function controlWindowIn(
  mode: WindowMode,
  log: Logger,
): (event: IpcMainEvent, value: unknown) => void {
  return (event, value) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win === null || !isWindowAction(value)) return;
    if (!allowsWindowAction(mode, value)) {
      log.info('ignored a window action on an offscreen window', {
        action: value,
      });
      return;
    }
    runWindowAction(win, value);
  };
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
  const listener = (event: IpcMainEvent, value: unknown): void =>
    handler(value, event.sender.id);
  ipcMain.on(channel, listener);
  return () => {
    ipcMain.removeListener(channel, listener);
  };
}

/**
 * Registers the IPC channels. Every incoming value is validated; invalid
 * values are logged and dropped.
 *
 * @param windowMode - In `offscreen` mode the title bar can only close the
 * control window, so it never shows.
 * @returns A function that removes everything this registered.
 */
export function registerIpc(
  store: LiveStore,
  log: Logger,
  windowMode: WindowMode,
): () => void {
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
  ipcMain.on(Channels.windowControl, controlWindowIn(windowMode, log));
  const stopLogWrites = listenToWindows(
    Channels.logWrite,
    handleLogWrite(log, new WindowLogLimiter(log)),
  );
  const unsubscribe = store.subscribe(state =>
    sendToWindows(Channels.liveChanged, state, log),
  );

  return () => {
    unsubscribe();
    stopLogWrites();
    ipcMain.removeHandler(Channels.liveGet);
    ipcMain.removeAllListeners(Channels.liveCommand);
    ipcMain.removeAllListeners(Channels.windowControl);
  };
}
