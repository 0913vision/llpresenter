import {
  BrowserWindow,
  ipcMain,
  type IpcMainEvent,
  type WebContents,
} from 'electron';
import type {Logger} from '../base/log';

const CHANNEL = 'test:gpu-failure';
const TIME_LIMIT_MS = 90_000;

function failGpu(kind: 'crash' | 'hang', log: Logger): void {
  const hidden = new BrowserWindow({
    show: false,
    webPreferences: {offscreen: true},
  });
  const close = (): void => {
    if (!hidden.isDestroyed()) hidden.destroy();
  };
  hidden.webContents.once('render-process-gone', close);
  hidden.loadURL(`chrome://gpu${kind}`).catch((error: unknown) => {
    log.info('GPU test navigation ended', {kind, error: String(error)});
  });
  setTimeout(close, TIME_LIMIT_MS);
}

/**
 * Lets a test make the GPU process crash or hang from the control window.
 *
 * @returns A function that stops listening.
 */
export function registerGpuTestHook(
  control: () => WebContents,
  log: Logger,
): () => void {
  const hear = ({sender}: IpcMainEvent, kind: unknown): void => {
    if (sender !== control()) return;
    if (kind === 'crash' || kind === 'hang') failGpu(kind, log);
  };
  ipcMain.on(CHANNEL, hear);
  return () => {
    ipcMain.removeListener(CHANNEL, hear);
  };
}
