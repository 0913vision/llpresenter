import {ipcMain} from 'electron';
import {Channels} from '@shared/ipc';
import {parseSettingsReadRequest} from '@shared/schema/settingsDocuments';
import type {Logger} from '../log';
import type {SettingsProblemListener, SettingsStore} from './settingsStore';

/** Owns the settings read handler and main-process problem subscriptions. */
export function registerSettingsReads(
  loading: Promise<SettingsStore | null>,
  log: Logger,
) {
  let disposed = false;
  ipcMain.handle(Channels.settingsGet, async (_event, value: unknown) => {
    const request = parseSettingsReadRequest(value);
    if (!request.ok) {
      log.warn('dropped a malformed settings read', request.error);
      throw new Error('Invalid settings read');
    }
    const store = await loading;
    if (disposed || !store) throw new Error('Settings unavailable');
    return store.get(request.value.name);
  });
  return {
    subscribe: (listener: SettingsProblemListener): (() => void) => {
      let removed = false;
      let unsubscribe: (() => void) | undefined;
      const active = (): boolean => !removed && !disposed;
      loading
        .then(store => {
          if (active() && store) {
            const stop = store.subscribeProblems(listener);
            if (!active()) stop();
            else unsubscribe = stop;
          }
        })
        .catch((error: unknown) =>
          log.error('could not subscribe to settings problems', error),
        );
      return () => {
        removed = true;
        unsubscribe?.();
      };
    },
    dispose: async () => {
      disposed = true;
      ipcMain.removeHandler(Channels.settingsGet);
      (await loading)?.dispose();
    },
  };
}
