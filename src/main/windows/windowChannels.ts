import {BrowserWindow, shell} from 'electron';
import {windowEndpoints, type WindowAction} from '@contracts/ipc/window';
import {IpcHost} from '../base/ipcHost';
import type {Logger} from '../base/log';
import {allowsWindowAction, type WindowMode} from '../base/testWindows';

/** What the 도움말 menu needs from the app. */
export interface AppFacts {
  readonly name: string;
  readonly version: string;
  readonly logDirectory: string;
  /** The text of 진단 정보. */
  readonly diagnostics: () => Promise<string>;
  /** Turns 자세한 기록 on or off. */
  readonly setVerbose: (on: boolean) => void;
  /** Whether 자세한 기록 is on. */
  readonly isVerbose: () => boolean;
}

interface WindowChannelOptions {
  /** An offscreen control window can only be closed, so it never shows. */
  readonly windowMode: WindowMode;
  /** Whether a window is the control window; only it may go full screen. */
  readonly isControlWindow: (win: BrowserWindow) => boolean;
  readonly app: AppFacts;
}

function runWindowAction(
  win: BrowserWindow,
  action: WindowAction,
  isControlWindow: (win: BrowserWindow) => boolean,
): void {
  switch (action) {
    case 'minimize':
      win.minimize();
      return;
    case 'toggle-maximize':
      if (win.isMaximized()) win.unmaximize();
      else win.maximize();
      return;
    case 'toggle-full-screen':
      if (isControlWindow(win)) win.setFullScreen(!win.isFullScreen());
      return;
    case 'close':
      win.close();
      return;
  }
}

/**
 * Answers the title bar, the text edits, and the 도움말 menu of every window.
 *
 * @returns A function that stops answering.
 */
export function registerWindowChannels(
  log: Logger,
  {windowMode, app, isControlWindow}: WindowChannelOptions,
): () => void {
  const ipc = new IpcHost(log);
  ipc.query(
    windowEndpoints.fullScreen,
    ({contents}) =>
      BrowserWindow.fromWebContents(contents)?.isFullScreen() ?? false,
  );
  ipc.query(
    windowEndpoints.minimized,
    ({contents}) =>
      BrowserWindow.fromWebContents(contents)?.isMinimized() ?? false,
  );
  ipc.message(windowEndpoints.control, (action, {contents}) => {
    const win = BrowserWindow.fromWebContents(contents);
    if (win === null) return;
    if (allowsWindowAction(windowMode, action)) {
      runWindowAction(win, action, isControlWindow);
    } else {
      log.info('ignored a window action on an offscreen window', {action});
    }
  });
  ipc.message(windowEndpoints.editText, (action, {contents}) => {
    try {
      contents[action]();
    } catch (error: unknown) {
      log.warn('could not run a text edit action', error);
    }
  });
  ipc.query(windowEndpoints.appInfo, () => ({
    name: app.name,
    version: app.version,
  }));
  ipc.query(windowEndpoints.diagnostics, app.diagnostics);
  ipc.message(windowEndpoints.verboseLogging, on => app.setVerbose(on));
  ipc.query(windowEndpoints.verboseLoggingState, () => app.isVerbose());
  ipc.signal(windowEndpoints.openLogFolder, () => {
    // NOTE(0913vision): An offscreen check must never open the file manager.
    if (windowMode === 'offscreen') return;
    shell.openPath(app.logDirectory).then(
      problem => {
        if (problem !== '') log.warn('could not open the log folder', problem);
      },
      (error: unknown) => log.warn('could not open the log folder', error),
    );
  });
  return () => ipc.close();
}
