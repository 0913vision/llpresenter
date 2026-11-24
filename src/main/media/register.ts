import type {SettingsReader} from '@core/schema/settingsReader';
import {randomUUID} from 'node:crypto';
import {dialog, shell, type BrowserWindow} from 'electron';
import {mediaEndpoints} from '@contracts/ipc/media';
import {createMediaId} from '@core/schema/ids';
import {defaultPreferences} from '@core/schema/preferences';
import type {MediaImportProgress} from '@core/schema/mediaEdit';
import {IpcHost} from '../base/ipcHost';
import type {Logger} from '../base/log';
import type {MediaBackendPort} from '../store/media/mediaBackend';
import type {UiStateFields} from '../store/locations/appConfigFile';
import {realPathInside} from '../base/insideRoots';
import {pickerFolder, rememberPickerFile} from '../uiState/pickerFolder';
import type {WindowMode} from '../base/testWindows';
import type {MediaAnalysis} from './analysis';
import {MediaImporter, type ImportStore} from './mediaImporter';
import {mediaDialogFilters, type MediaKind} from './mediaKinds';
import {MediaRelinker, type RelinkStore} from './mediaRelinker';
import {MissingFiles, type MissingFilesSource} from './missingFiles';

/** What the media backend uses of the media store. */
export type MediaBackendStore = ImportStore &
  RelinkStore &
  MissingFilesSource & {
    /** The folders media files may come from; 파일 위치 열기 stays inside them. */
    readonly roots: readonly string[];
  };

/** The arguments of {@link registerMediaBackend}. */
export interface MediaBackendRegistration {
  readonly port: MediaBackendPort;
  readonly media: Promise<MediaBackendStore | null>;
  readonly control: BrowserWindow;
  readonly windowMode: WindowMode;
  /** Analysis and thumbnails for imports; their owner disposes them. */
  readonly analysis: Pick<MediaAnalysis, 'analyse' | 'saveThumbnail'>;
  readonly log: Logger;
  readonly uiState: UiStateFields;
  readonly settings?: Promise<Pick<SettingsReader, 'preferences'> | null>;
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
    const defaultPath = await pickerFolder(
      options.uiState,
      'mediaImportFolder',
    );
    const chosen = await dialog.showOpenDialog(parent, {
      defaultPath,
      properties: ['openFile', 'multiSelections'],
      filters: mediaDialogFilters(),
    });
    if (chosen.canceled) return [];
    rememberPickerFile(
      options.uiState,
      'mediaImportFolder',
      chosen.filePaths[0],
    );
    return chosen.filePaths;
  };
}

function relinkDialog(
  options: MediaBackendRegistration,
): (kind: MediaKind) => Promise<string | null> {
  return async kind => {
    const parent = dialogParent(options, 'relink');
    if (parent === null) return null;
    const chosen = await dialog.showOpenDialog(parent, {
      defaultPath: await pickerFolder(options.uiState, 'mediaRelinkFolder'),
      properties: ['openFile'],
      filters: mediaDialogFilters([kind]),
    });
    if (chosen.canceled) return null;
    rememberPickerFile(
      options.uiState,
      'mediaRelinkFolder',
      chosen.filePaths[0],
    );
    return chosen.filePaths[0] ?? null;
  };
}

function watchMissingFiles(
  {media, log}: MediaBackendRegistration,
  ipc: IpcHost,
): () => MissingFiles | null {
  let missing: MissingFiles | null = null;
  let stopped = false;
  ipc.whenClosed(() => {
    stopped = true;
    missing?.dispose();
  });
  const ready = media.then(
    store => {
      if (stopped || store === null) return;
      missing = new MissingFiles({
        source: store,
        onChange: value => {
          ipc.push(mediaEndpoints.missingChanged, value);
        },
        onStamps: value => {
          ipc.push(mediaEndpoints.stampsChanged, value);
        },
      });
      missing.start();
    },
    (error: unknown) => {
      log.error('could not check the media files', error);
    },
  );
  ipc.query(mediaEndpoints.missing, async () => {
    await ready;
    return missing?.list() ?? [];
  });
  ipc.query(mediaEndpoints.stamps, async () => {
    await ready;
    return missing?.stampList() ?? {};
  });
  ipc.message(mediaEndpoints.check, ({mediaId}) => {
    missing?.check(mediaId);
  });
  return () => missing;
}

// NOTE(0913vision): A window names only a media id, and the file must be
// inside the media folders after links are followed, as the media scheme
// checks, so 파일 위치 열기 can't open any other path.
async function revealFile(
  media: Promise<MediaBackendStore | null>,
  mediaId: string,
  log: Logger,
): Promise<void> {
  const store = await media;
  const file = store?.fileOf(mediaId) ?? null;
  const inside =
    store === null || file === null
      ? null
      : await realPathInside(file, store.roots);
  if (inside === null) {
    log.info('no media file to reveal inside the media folders', {mediaId});
    return;
  }
  shell.showItemInFolder(inside);
}

function listenForReveals(
  {media, log, windowMode}: MediaBackendRegistration,
  ipc: IpcHost,
): void {
  ipc.message(mediaEndpoints.reveal, ({mediaId}) => {
    if (windowMode === 'offscreen') {
      log.info('media file reveal is unavailable in offscreen mode');
      return;
    }
    revealFile(media, mediaId, log).catch((error: unknown) => {
      log.error('could not reveal a media file', error);
    });
  });
}

/**
 * Connects the media backend to the media channels: the import dialog on the
 * control window, copying into the media folder with progress and analysis,
 * cancelling, relinking a file, the missing file check, and 파일 위치 열기. Never throws: a
 * backend that can't connect is logged, and the missing file check still runs.
 *
 * @returns A function that cancels every import job, waits for the running
 * one, and disconnects.
 */
export function registerMediaBackend(
  options: MediaBackendRegistration,
): () => Promise<void> {
  const ipc = new IpcHost(options.log);
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
    analyse: options.analysis.analyse,
    saveThumbnail: options.analysis.saveThumbnail,
    log: options.log,
    // NOTE(0913vision): without a settings store a new import takes the built-in defaults.
    defaults: async () =>
      (await options.settings)?.preferences().media.defaults ??
      defaultPreferences.media.defaults,
  });
  const missing = watchMissingFiles(options, ipc);
  listenForReveals(options, ipc);
  const relinker = new MediaRelinker({
    store: () => options.media,
    chooseFile: relinkDialog(options),
    isMissing: mediaId => missing()?.isMissing(mediaId) ?? false,
    recheck: mediaIds => {
      for (const mediaId of mediaIds) missing()?.check(mediaId);
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
      ipc.close();
      await importer.dispose();
      connection.disconnect();
    };
  } catch (error: unknown) {
    options.log.error('could not connect the media backend', error);
    return () => {
      ipc.close();
      return importer.dispose();
    };
  }
}
