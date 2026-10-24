import {ipcMain} from 'electron';
import {Channels} from '@shared/ipc';
import type {Logger} from '../log';
import {fileIo} from './fileIo';
import {UiStateStore} from './uiStateStore';

export interface UiStateRegistration {
  /** Removes the channels and writes pending changes. */
  dispose(): Promise<void>;
}

/**
 * Reads `app.json` and registers the UI state channels (`ui:get` and
 * `ui:layout:set`). Call it before the control window opens, so that the
 * window finds its state. The app's shutdown calls `dispose()` to write the
 * pending changes before it quits.
 *
 * @param file - The path of `app.json`.
 */
export async function registerUiState(
  file: string,
  log: Logger,
): Promise<UiStateRegistration> {
  const store = new UiStateStore({file, io: fileIo, log});
  await store.load();
  ipcMain.handle(Channels.uiGet, () => store.state);
  ipcMain.on(Channels.uiLayoutSet, (_event, value: unknown) =>
    store.setLayout(value),
  );

  return {
    dispose: async () => {
      ipcMain.removeHandler(Channels.uiGet);
      ipcMain.removeAllListeners(Channels.uiLayoutSet);
      store.dispose();
      await store.flush();
    },
  };
}
