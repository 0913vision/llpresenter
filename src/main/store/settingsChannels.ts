import {ipcMain, type WebContents} from 'electron';
import {parseLabelColorPreviewRequest} from '@core/schema/labelColorPreview';
import {settingsEndpoints} from '@contracts/ipc/settings';
import type {EditResult} from '@core/schema/contentEdit';
import {
  parseSettingsEdit,
  parseSettingsReadRequest,
  type LabelRename,
} from '@core/schema/settingsDocuments';
import type {Logger} from '../log';
import {broadcast} from './contentChannels';
import type {SettingsProblemListener, SettingsStore} from './settingsStore';

const UNAVAILABLE: EditResult = {
  ok: false,
  error: {reason: 'not-found', message: 'Settings are unavailable'},
};

/** Registers settings reads, edits, pushes, and main-process problem subscriptions. */
export function registerSettingsChannels(
  loading: Promise<Pick<
    SettingsStore,
    | 'subscribe'
    | 'subscribeProblems'
    | 'preferences'
    | 'get'
    | 'apply'
    | 'dispose'
  > | null>,
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
  let previewOwner: WebContents | undefined;
  const clearPreview = (): void => {
    previewOwner?.removeListener('destroyed', clearPreview);
    previewOwner = undefined;
    broadcast(settingsEndpoints.labelColorPreview.channel, null, log);
  };
  const changes = ready.then(store => {
    if (disposed || store === null) return;
    removeChanges = store.subscribe(document => {
      if (document.name === 'labels' && previewOwner !== undefined) {
        clearPreview();
      }
      broadcast(settingsEndpoints.changed.channel, document, log);
      if (document.name === 'preferences') {
        broadcast(
          settingsEndpoints.preferencesChanged.channel,
          store.preferences(),
          log,
        );
      }
    });
  });
  ipcMain.handle(
    settingsEndpoints.previewLabelColor.channel,
    async (event, value: unknown) => {
      const parsed = parseLabelColorPreviewRequest(value);
      if (!parsed.ok) {
        log.warn('dropped a malformed label color preview', parsed.error);
        return false;
      }
      const store = await ready;
      if (disposed || store === null || event.sender.isDestroyed()) {
        return false;
      }
      const {name, color} = parsed.value;
      if (color === null) {
        if (previewOwner === event.sender) clearPreview();
        return true;
      }
      const document = store.get('labels');
      if (
        document.name !== 'labels' ||
        document.access !== 'editable' ||
        !document.value.labels.some(label => label.name === name)
      ) {
        return false;
      }
      if (previewOwner !== event.sender) {
        if (previewOwner !== undefined) clearPreview();
        previewOwner = event.sender;
        previewOwner.once('destroyed', clearPreview);
      }
      broadcast(
        settingsEndpoints.labelColorPreview.channel,
        {name, color},
        log,
      );
      return true;
    },
  );
  ipcMain.handle(
    settingsEndpoints.get.channel,
    async (_event, value: unknown) => {
      const request = parseSettingsReadRequest(value);
      if (!request.ok) {
        log.warn('dropped a malformed settings read', request.error);
        throw new Error('Invalid settings read');
      }
      const store = await ready;
      if (disposed || store === null) throw new Error('Settings unavailable');
      return store.get(request.value.name);
    },
  );
  ipcMain.handle(
    settingsEndpoints.edit.channel,
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
      ipcMain.removeHandler(settingsEndpoints.get.channel);
      ipcMain.removeHandler(settingsEndpoints.edit.channel);
      ipcMain.removeHandler(settingsEndpoints.previewLabelColor.channel);
      if (previewOwner !== undefined) clearPreview();
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
