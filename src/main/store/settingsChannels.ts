import {ipcMain} from 'electron';
import {Channels} from '@shared/ipc';
import type {EditResult} from '@shared/schema/contentEdit';
import {
  parseSettingsEdit,
  parseSettingsReadRequest,
  type LabelRename,
} from '@shared/schema/settingsDocuments';
import type {Logger} from '../log';
import {broadcast} from './contentChannels';
import type {SettingsProblemListener, SettingsStore} from './settingsStore';

const UNAVAILABLE: EditResult = {
  ok: false,
  error: {reason: 'not-found', message: 'Settings are unavailable'},
};

/** Registers settings reads, edits, pushes, and main-process problem subscriptions. */
export function registerSettingsChannels(
  loading: Promise<SettingsStore | null>,
  log: Logger,
  renameLabel?: (edit: LabelRename) => Promise<EditResult>,
) {
  let disposed = false;
  let closing: Promise<void> | null = null;
  let renaming: Promise<void> = Promise.resolve();
  const ready = loading.catch((error: unknown) => {
    log.error('could not open settings channels', error);
    return null;
  });
  let removeChanges: (() => void) | undefined;
  const changes = ready.then(store => {
    if (disposed || store === null) return;
    removeChanges = store.subscribe(document => {
      broadcast(Channels.settingsChanged, document, log);
      if (document.name === 'preferences') {
        broadcast(Channels.preferencesChanged, store.preferences(), log);
      }
    });
  });
  ipcMain.handle(Channels.settingsGet, async (_event, value: unknown) => {
    const request = parseSettingsReadRequest(value);
    if (!request.ok) {
      log.warn('dropped a malformed settings read', request.error);
      throw new Error('Invalid settings read');
    }
    const store = await ready;
    if (disposed || store === null) throw new Error('Settings unavailable');
    return store.get(request.value.name);
  });
  ipcMain.handle(
    Channels.settingsEdit,
    async (_event, value: unknown): Promise<EditResult> => {
      const edit = parseSettingsEdit(value);
      if (!edit.ok) {
        log.warn('dropped a malformed settings edit', edit.error);
        return {
          ok: false,
          error: {
            reason: 'invalid',
            message: `${edit.error.field}: ${edit.error.message}`,
          },
        };
      }
      const store = await ready;
      if (disposed || store === null) return UNAVAILABLE;
      if (edit.value.type !== 'labels.rename') return store.apply(edit.value);
      const rename = edit.value;
      const result = renaming
        .then(() => renameLabel?.(rename) ?? UNAVAILABLE)
        .catch((error: unknown): EditResult => {
          log.error('could not rename a label', error);
          return {
            ok: false,
            error: {reason: 'invalid', message: 'Could not rename the label'},
          };
        });
      renaming = result.then(() => undefined);
      return result;
    },
  );
  return {
    subscribe: (listener: SettingsProblemListener): (() => void) => {
      let removed = false;
      let unsubscribe: (() => void) | undefined;
      const active = (): boolean => !removed && !disposed;
      ready
        .then(store => {
          if (!active() || store === null) return;
          const stop = store.subscribeProblems(listener);
          if (!active()) stop();
          else unsubscribe = stop;
        })
        .catch((error: unknown) =>
          log.error('could not subscribe to settings problems', error),
        );
      return () => {
        removed = true;
        unsubscribe?.();
      };
    },
    dispose: (): Promise<void> => {
      if (closing !== null) return closing;
      disposed = true;
      ipcMain.removeHandler(Channels.settingsGet);
      ipcMain.removeHandler(Channels.settingsEdit);
      removeChanges?.();
      closing = (async () => {
        await changes;
        await renaming;
        await (await ready)?.dispose();
      })();
      return closing;
    },
  };
}
