import {randomUUID} from 'node:crypto';
import {dialog, type BrowserWindow} from 'electron';
import {createMediaId} from '@shared/schema/ids';
import type {MediaImportProgress} from '@shared/schema/mediaEdit';
import type {Logger} from '../log';
import type {MediaBackendPort} from '../store/mediaChannels';
import {mediaRefusal} from '../store/mediaEdits';
import type {WindowMode} from '../windows/testWindows';
import {MediaImporter, type ImportStore} from './mediaImporter';
import {mediaDialogFilters} from './mediaKinds';

/** The arguments of {@link registerMediaImport}. */
export interface MediaImportRegistration {
  readonly port: MediaBackendPort;
  readonly media: Promise<ImportStore | null>;
  readonly control: BrowserWindow;
  readonly windowMode: WindowMode;
  readonly log: Logger;
}

function importDialog({
  control,
  windowMode,
  log,
}: MediaImportRegistration): () => Promise<readonly string[]> {
  return async () => {
    if (windowMode === 'offscreen' || control.isDestroyed()) {
      log.info('the media import dialog is unavailable');
      return [];
    }
    const chosen = await dialog.showOpenDialog(control, {
      properties: ['openFile', 'multiSelections'],
      filters: mediaDialogFilters(),
    });
    return chosen.canceled ? [] : chosen.filePaths;
  };
}

/**
 * Connects the media import backend to the media channels: the import dialog
 * on the control window, copying into the media folder with progress, and
 * cancelling. Never throws: a backend that can't connect is logged.
 *
 * @returns A function that cancels every job, waits for the running one, and
 * disconnects.
 */
export function registerMediaImport(
  options: MediaImportRegistration,
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
  try {
    const connection = options.port.connect({
      import: (request, signal) => importer.import(request, signal),
      // TODO(0913vision): P6a-2 relinks a missing file here.
      relink: () =>
        Promise.resolve(mediaRefusal('invalid', 'Relinking is not available')),
      cancel: mediaId => importer.cancel(mediaId),
    });
    progress.send = value => {
      connection.report(value);
    };
    return async () => {
      await importer.dispose();
      connection.disconnect();
    };
  } catch (error: unknown) {
    options.log.error('could not connect media import', error);
    return () => importer.dispose();
  }
}
