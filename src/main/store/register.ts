import {app, ipcMain} from 'electron';
import {Channels} from '@shared/ipc';
import type {ShowService} from '@shared/schema/showService';
import type {Logger} from '../log';
import {Backups, type BackupOutcome} from './backup';
import {
  loadStore,
  type AppConfigView,
  type LoadedStore,
  type StoreContext,
} from './fileStore';
import {dataFileFolders, type LocationContext} from './locations';
import {LoadingMediaLibrary} from './mediaLibrary';
import {buildShowService} from './showService';
import {removeStaleTempFiles} from './staleTempFiles';

const FIRST_REVISION = 1;
const MAX_LOGGED_PROBLEMS = 50;

export interface StoreRegistration {
  readonly log: Logger;
  /** Whether any output is on. A backup never starts while one is. */
  readonly isAnyOutputOn: () => boolean;
  /** `app.json`, opened once at launch with `openAppConfig`. */
  readonly appConfig: AppConfigView;
  /** Where the data folders default to. Electron's folders by default. */
  readonly context?: () => LocationContext;
}

/** What the main process wiring uses of the data store. */
export interface DataStore {
  /**
   * Removes the handler and resolves once the launch backup has ended, so
   * quitting never cuts a backup off halfway.
   */
  readonly dispose: () => Promise<void>;
  /**
   * The file of a media id from `media.json`, once the data is read, or
   * `null` when there is none.
   */
  readonly findMediaFile: (mediaId: string) => Promise<string | null>;
  /** The folders media files may come from; none before the data is read. */
  readonly mediaRoots: () => readonly string[];
}

/**
 * Reads the data at launch, answers `service:get` with the open 예배 순서,
 * finds media files by id, and then runs the launch backup once. A window that
 * asks before the data is read waits for it. Never throws: a failure, or a
 * data folder that a link leads outside `LLP_USER_DATA`, is logged, and the
 * answer is `null`.
 */
export function registerStore({
  log,
  isAnyOutputOn,
  appConfig,
  context = electronLocationContext,
}: StoreRegistration): DataStore {
  const loading = readStore(() => ({...context(), appConfig}), log);
  const opening = openShowService(loading, log);
  ipcMain.handle(Channels.serviceGet, () => opening);
  // TODO(0913vision): Push `service:changed` with the next revision when the
  // open 예배 순서, one of its songs, or the 이름표 change.
  const upkeep = upkeepAtLaunch(loading, isAnyOutputOn, log);
  const media = new LoadingMediaLibrary(loading);
  return {
    dispose: async () => {
      ipcMain.removeHandler(Channels.serviceGet);
      await upkeep;
    },
    findMediaFile: media.findFile,
    mediaRoots: media.roots,
  };
}

/** Documents, and the `LLP_USER_DATA` folder if set. */
export function electronLocationContext(): LocationContext {
  const developmentFolder = process.env['LLP_USER_DATA'] ?? '';
  return {
    documents: app.getPath('documents'),
    developmentFolder: developmentFolder === '' ? null : developmentFolder,
  };
}

async function readStore(
  context: () => StoreContext,
  log: Logger,
): Promise<LoadedStore | null> {
  try {
    const loaded = await loadStore(context());
    if (!loaded.ok) {
      log.error('refused the data folder', loaded.error);
      return null;
    }
    logLoadedStore(loaded.value, log);
    return loaded.value;
  } catch (error: unknown) {
    log.error('could not read the data folder', error);
    return null;
  }
}

async function openShowService(
  loading: Promise<LoadedStore | null>,
  log: Logger,
): Promise<ShowService | null> {
  const store = await loading;
  try {
    return store === null ? null : showServiceOf(store);
  } catch (error: unknown) {
    log.error('could not build the open 예배 순서', error);
    return null;
  }
}

// NOTE(0913vision): Leftover temporary files go before the backup, so a backup
// never copies them.
async function upkeepAtLaunch(
  loading: Promise<LoadedStore | null>,
  isAnyOutputOn: () => boolean,
  log: Logger,
): Promise<void> {
  const store = await loading;
  if (store === null) {
    return;
  }
  await removeLeftoverTempFiles(store, log);
  await backUpAtLaunch(store, isAnyOutputOn, log);
}

async function removeLeftoverTempFiles(
  store: LoadedStore,
  log: Logger,
): Promise<void> {
  for (const name of dataFileFolders) {
    for (const problem of await removeStaleTempFiles(store.locations[name])) {
      log.warn('could not remove a leftover temporary file', problem);
    }
  }
}

async function backUpAtLaunch(
  store: LoadedStore,
  isAnyOutputOn: () => boolean,
  log: Logger,
): Promise<void> {
  try {
    const backups = new Backups({
      locations: store.locations,
      developmentFolder: store.developmentFolder,
      preferences: () => store.preferences.backup,
      isAnyOutputOn,
    });
    logBackupOutcome(await backups.atLaunch(), log);
  } catch (error: unknown) {
    log.error('the launch backup failed', error);
  }
}

function showServiceOf(store: LoadedStore): ShowService | null {
  const service =
    store.openServiceId === null
      ? undefined
      : store.services.get(store.openServiceId);
  if (service === undefined) {
    return null;
  }
  return buildShowService({
    service,
    songs: store.songs,
    labels: store.labels,
    revision: FIRST_REVISION,
  });
}

function logLoadedStore(store: LoadedStore, log: Logger): void {
  log.info('read the data folder', {
    dataRoot: store.locations.dataRoot,
    songs: store.songs.size,
    services: store.services.size,
    openServiceId: store.openServiceId,
  });
  for (const problem of store.problems.slice(0, MAX_LOGGED_PROBLEMS)) {
    log.warn('skipped a data file or a part of one', problem);
  }
  const unlogged = store.problems.length - MAX_LOGGED_PROBLEMS;
  if (unlogged > 0) {
    log.warn(`skipped ${unlogged} more data files or parts of them`);
  }
}

function logBackupOutcome(outcome: BackupOutcome, log: Logger): void {
  switch (outcome.kind) {
    case 'done':
      log.info('backed up the data', {folder: outcome.backup.folder});
      for (const problem of outcome.backup.problems) {
        log.warn('could not delete an old backup', problem);
      }
      return;
    case 'skipped':
      log.info('skipped the launch backup', {reason: outcome.reason});
      return;
    case 'failed':
      log.warn('the launch backup failed', outcome.problem);
      return;
  }
}
