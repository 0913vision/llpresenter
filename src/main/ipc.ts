import {BrowserWindow, ipcMain, type IpcMainEvent} from 'electron';
import {windowActions, type WindowAction} from '@contracts/ipc/api';
import {liveEndpoints} from '@contracts/ipc/live';
import {outputEndpoints} from '@contracts/ipc/output';
import {windowEndpoints} from '@contracts/ipc/window';
import {parseLiveCommandRequest} from '@core/schema/liveCommand';
import type {Logger} from './log';
import {dispatchLogged, type LiveStore} from './live/store';
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
  answer: (event: unknown, value?: unknown) => unknown,
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
  ipcMain.handle(liveEndpoints.get.channel, () => store.state);
  ipcMain.handle(liveEndpoints.clock.channel, () => store.timerNow());
  ipcMain.on(liveEndpoints.command.channel, (_event, value: unknown) => {
    const command = parseLiveCommandRequest(value);
    if (!command.ok) {
      log.warn('dropped a malformed command', command.error);
      return;
    }
    for (const error of command.value.rejected) {
      log.warn('dropped a malformed command', error);
    }
    dispatchLogged(store, command.value.command, log);
  });
  ipcMain.on(windowEndpoints.control.channel, controlWindowIn(windowMode, log));
  const stopLogWrites = listenToWindows(
    outputEndpoints.log.channel,
    handleLogWrite(log, new WindowLogLimiter(log)),
  );
  const unsubscribe = store.subscribe(state =>
    sendToWindows(liveEndpoints.changed.channel, state, log),
  );

  return () => {
    unsubscribe();
    stopLogWrites();
    ipcMain.removeHandler(liveEndpoints.get.channel);
    ipcMain.removeHandler(liveEndpoints.clock.channel);
    ipcMain.removeAllListeners(liveEndpoints.command.channel);
    ipcMain.removeAllListeners(windowEndpoints.control.channel);
  };
}
