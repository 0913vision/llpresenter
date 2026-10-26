import {randomUUID} from 'node:crypto';
import {dirname, isAbsolute} from 'node:path';
import {
  app,
  dialog,
  ipcMain,
  shell,
  type BrowserWindow,
  type IpcMainEvent,
} from 'electron';
import {Channels} from '@shared/ipc';
import {createMediaId} from '@shared/schema/ids';
import type {MediaImportProgress} from '@shared/schema/mediaEdit';
import {
  parseMediaCheckRequest,
  parseMediaRevealRequest,
} from '@shared/schema/mediaFiles';
import type {Logger} from '../log';
import {broadcast} from '../store/contentChannels';
import type {MediaBackendPort} from '../store/mediaChannels';
import type {UiStateFields} from '../store/appConfigFile';
import type {SettingsReader} from '../store/settingsStore';
import {realPathInside} from '../windows/insideRoots';
import type {WindowMode} from '../windows/testWindows';
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
    const remembered = options.uiState.read().mediaImportFolder;
    const defaultPath =
      remembered !== undefined && isAbsolute(remembered)
        ? remembered
        : app.getPath('videos');
    const chosen = await dialog.showOpenDialog(parent, {
      defaultPath,
      properties: ['openFile', 'multiSelections'],
      filters: mediaDialogFilters(),
    });
    if (chosen.canceled) return [];
    const first = chosen.filePaths[0];
    if (first !== undefined && isAbsolute(first)) {
      options.uiState.change({mediaImportFolder: dirname(first)});
    }
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

function listenForReveals({
  media,
  log,
  windowMode,
}: MediaBackendRegistration): () => void {
  const reveal = (_event: IpcMainEvent, value: unknown): void => {
    const parsed = parseMediaRevealRequest(value);
    if (!parsed.ok) {
      log.warn('dropped a malformed media reveal', parsed.error);
      return;
    }
    if (windowMode === 'offscreen') {
      log.info('media file reveal is unavailable in offscreen mode');
      return;
    }
    revealFile(media, parsed.value.mediaId, log).catch((error: unknown) => {
      log.error('could not reveal a media file', error);
    });
  };
  ipcMain.on(Channels.mediaReveal, reveal);
  return () => {
    ipcMain.removeListener(Channels.mediaReveal, reveal);
  };
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
    copyIntoFolder: async () =>
      (await options.settings)?.preferences().media.copyOnImport ?? false,
  });
  const missing = watchMissingFiles(options);
  const stopReveals = listenForReveals(options);
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
      stopReveals();
      await importer.dispose();
      connection.disconnect();
    };
  } catch (error: unknown) {
    options.log.error('could not connect the media backend', error);
    return () => {
      missing.dispose();
      stopReveals();
      return importer.dispose();
    };
  }
}
