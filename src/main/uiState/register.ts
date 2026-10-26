import {ipcMain} from 'electron';
import {Channels} from '@shared/ipc';
import type {Logger} from '../log';
import type {UiStateFields} from '../store/appConfigFile';
import {UiStateStore} from './uiStateStore';

export interface UiStateRegistration {
  /** Removes the channels. */
  dispose(): void;
}

/**
 * Registers UI reads, layout changes, and media choices on the UI
 * fields of `app.json`. Call it before the control window opens, so that the
 * window finds its state. The data store saves the file, and the app's
 * shutdown saves it before quitting, so `dispose()` only removes the channels.
 *
 * @param fields - The UI fields of the data store's `app.json`.
 */
export function registerUiState(
  fields: UiStateFields,
  log: Logger,
): UiStateRegistration {
  const store = new UiStateStore({fields, log});
  ipcMain.handle(Channels.uiGet, () => store.state);
  ipcMain.on(Channels.uiLayoutSet, (_event, value: unknown) =>
    store.setLayout(value),
  );
  ipcMain.on(Channels.uiMediaStripSet, (_event, value: unknown) =>
    store.setMediaStrip(value),
  );
  ipcMain.on(Channels.uiPrepMediaSet, (_event, value: unknown) =>
    store.setPrepMedia(value),
  );
  ipcMain.on(Channels.uiMediaBrowserSet, (_event, value: unknown) =>
    store.setMediaBrowser(value),
  );

  return {
    dispose: () => {
      ipcMain.removeHandler(Channels.uiGet);
      ipcMain.removeAllListeners(Channels.uiLayoutSet);
      ipcMain.removeAllListeners(Channels.uiMediaStripSet);
      ipcMain.removeAllListeners(Channels.uiPrepMediaSet);
      ipcMain.removeAllListeners(Channels.uiMediaBrowserSet);
    },
  };
}
