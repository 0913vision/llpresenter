import {randomUUID} from 'node:crypto';
import {dialog, ipcMain, type BrowserWindow, type IpcMainEvent} from 'electron';
import {Channels} from '@shared/ipc';
import {createMediaId} from '@shared/schema/ids';
import type {MediaImportProgress} from '@shared/schema/mediaEdit';
import {parseMediaCheckRequest} from '@shared/schema/mediaFiles';
import type {Logger} from '../log';
import {broadcast} from '../store/contentChannels';
import type {MediaBackendPort} from '../store/mediaChannels';
import type {WindowMode} from '../windows/testWindows';
import {MediaImporter, type ImportStore} from './mediaImporter';
import {mediaDialogFilters, type MediaKind} from './mediaKinds';
import {MediaRelinker, type RelinkStore} from './mediaRelinker';
import {MissingFiles, type MissingFilesSource} from './missingFiles';

/** What the media backend uses of the media store. */
export type MediaBackendStore = ImportStore & RelinkStore & MissingFilesSource;

/** The arguments of {@link registerMediaBackend}. */
export interface MediaBackendRegistration {
  readonly port: MediaBackendPort;
  readonly media: Promise<MediaBackendStore | null>;
  readonly control: BrowserWindow;
  readonly windowMode: WindowMode;
  readonly log: Logger;
}

function dialogParent(
  {control, windowMode, log}: MediaBackendRegistration,
  purpose: 'import' | 'relink',
): BrowserWindow | null {
  if (windowMode === 'offscreen' || control.isDestroyed()) {
    log.info(`the media ${purpose} dialog is unavailable`);
    return null;
  }
  return control;
}

function importDialog(
  options: MediaBackendRegistration,
): () => Promise<readonly string[]> {
  return async () => {
    const parent = dialogParent(options, 'import');
    if (parent === null) return [];
    const chosen = await dialog.showOpenDialog(parent, {
      properties: ['openFile', 'multiSelections'],
      filters: mediaDialogFilters(),
    });
    return chosen.canceled ? [] : chosen.filePaths;
  };
}

function relinkDialog(
  options: MediaBackendRegistration,
): (kind: MediaKind) => Promise<string | null> {
  return async kind => {
    const parent = dialogParent(options, 'relink');
    if (parent === null) return null;
    const chosen = await dialog.showOpenDialog(parent, {
      properties: ['openFile'],
      filters: mediaDialogFilters([kind]),
    });
    return chosen.canceled ? null : (chosen.filePaths[0] ?? null);
  };
}

function watchMissingFiles({media, log}: MediaBackendRegistration): {
  readonly files: () => MissingFiles | null;
  readonly dispose: () => void;
} {
  let missing: MissingFiles | null = null;
  let stopped = false;
  const ready = media.then(
    store => {
      if (stopped || store === null) return;
      missing = new MissingFiles({
        source: store,
        onChange: value => {
          broadcast(Channels.mediaMissing, value, log);
        },
      });
      missing.start();
    },
    (error: unknown) => {
      log.error('could not check the media files', error);
    },
  );
  ipcMain.handle(Channels.mediaMissingGet, async () => {
    await ready;
    return missing?.list() ?? [];
  });
  const check = (_event: IpcMainEvent, value: unknown): void => {
    const parsed = parseMediaCheckRequest(value);
    if (!parsed.ok) {
      log.warn('dropped a malformed media check', parsed.error);
      return;
    }
    missing?.check(parsed.value.mediaId);
  };
  ipcMain.on(Channels.mediaCheck, check);
  return {
    files: () => missing,
    dispose: () => {
      stopped = true;
      missing?.dispose();
      ipcMain.removeHandler(Channels.mediaMissingGet);
      ipcMain.removeListener(Channels.mediaCheck, check);
    },
  };
}

/**
 * Connects the media backend to the media channels: the import dialog on the
 * control window, copying into the media folder with progress, cancelling,
 * relinking a file, and the missing file check. Never throws: a backend that
 * can't connect is logged, and the missing file check still runs.
 *
 * @returns A function that cancels every import job, waits for the running
 * one, and disconnects.
 */
export function registerMediaBackend(
  options: MediaBackendRegistration,
): () => Promise<void> {
  const progress: {send: (value: MediaImportProgress) => void} = {
    send: () => undefined,
  };
  const importer = new MediaImporter({
    store: () => options.media,
    report: value => {
      progress.send(value);
    },
    chooseFiles: importDialog(options),
    createId: () => createMediaId(randomUUID()),
    log: options.log,
  });
  const missing = watchMissingFiles(options);
  const relinker = new MediaRelinker({
    store: () => options.media,
    chooseFile: relinkDialog(options),
    isMissing: mediaId => missing.files()?.isMissing(mediaId) ?? false,
    recheck: mediaIds => {
      for (const mediaId of mediaIds) missing.files()?.check(mediaId);
    },
    log: options.log,
  });
  try {
    const connection = options.port.connect({
      import: (request, signal) => importer.import(request, signal),
      relink: (mediaId, signal) => relinker.relink(mediaId, signal),
      cancel: mediaId => importer.cancel(mediaId),
    });
    progress.send = value => {
      connection.report(value);
    };
    return async () => {
      missing.dispose();
      await importer.dispose();
      connection.disconnect();
    };
  } catch (error: unknown) {
    options.log.error('could not connect the media backend', error);
    return () => {
      missing.dispose();
      return importer.dispose();
    };
  }
}
