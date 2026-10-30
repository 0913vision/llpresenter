import {ipcMain} from 'electron';
import {uiEndpoints} from '@contracts/ipc/ui';
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
  ipcMain.handle(uiEndpoints.get.channel, () => store.state);
  ipcMain.on(uiEndpoints.setLayout.channel, (_event, value: unknown) =>
    store.setLayout(value),
  );
  ipcMain.on(uiEndpoints.setMediaStrip.channel, (_event, value: unknown) =>
    store.setMediaStrip(value),
  );
  ipcMain.on(uiEndpoints.setPrepMedia.channel, (_event, value: unknown) =>
    store.setPrepMedia(value),
  );
  ipcMain.on(uiEndpoints.setMediaBrowser.channel, (_event, value: unknown) =>
    store.setMediaBrowser(value),
  );

  return {
    dispose: () => {
      ipcMain.removeHandler(uiEndpoints.get.channel);
      ipcMain.removeAllListeners(uiEndpoints.setLayout.channel);
      ipcMain.removeAllListeners(uiEndpoints.setMediaStrip.channel);
      ipcMain.removeAllListeners(uiEndpoints.setPrepMedia.channel);
      ipcMain.removeAllListeners(uiEndpoints.setMediaBrowser.channel);
    },
  };
}
