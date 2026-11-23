import {uiEndpoints} from '@contracts/ipc/ui';
import {IpcHost} from '../base/ipcHost';
import type {Logger} from '../base/log';
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
  const ipc = new IpcHost(log);
  const store = new UiStateStore(fields);
  ipc.query(uiEndpoints.get, () => store.state);
  ipc.message(uiEndpoints.setLayout, change => store.setLayout(change));
  ipc.message(uiEndpoints.setMediaStrip, change => store.setMediaStrip(change));
  ipc.message(uiEndpoints.setMediaBrowser, change =>
    store.setMediaBrowser(change),
  );
  ipc.message(uiEndpoints.setRememberedView, change =>
    store.setRememberedView(change),
  );
  return {
    dispose: () => {
      ipc.close();
    },
  };
}
