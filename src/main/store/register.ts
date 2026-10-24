import {app, ipcMain} from 'electron';
import {Channels} from '@shared/ipc';
import type {ShowService} from '@shared/schema/showService';
import type {Logger} from '../log';
import {loadStore, type LoadedStore, type StoreContext} from './fileStore';
import {buildShowService} from './showService';

const FIRST_REVISION = 1;
const MAX_LOGGED_PROBLEMS = 50;

/**
 * Reads the data at launch and answers `service:get` with the open 예배 순서. A
 * window that asks before the data is read waits for it. Never throws: a
 * failure, or a data folder that a link leads outside `LLP_USER_DATA`, is
 * logged, and the answer is `null`.
 *
 * @param context - Where the data is. Electron's folders by default.
 * @returns A function that removes the handler.
 */
export function registerStore(
  log: Logger,
  context: () => StoreContext = electronStoreContext,
): () => void {
  const opening = openShowService(context, log);
  ipcMain.handle(Channels.serviceGet, () => opening);
  // TODO(0913vision): Push `service:changed` with the next revision when the
  // open 예배 순서, one of its songs, or the 이름표 change.
  return () => ipcMain.removeHandler(Channels.serviceGet);
}

/** The app data folder, Documents, and the `LLP_USER_DATA` folder if set. */
export function electronStoreContext(): StoreContext {
  const developmentFolder = process.env['LLP_USER_DATA'] ?? '';
  return {
    appDataFolder: app.getPath('userData'),
    documents: app.getPath('documents'),
    developmentFolder: developmentFolder === '' ? null : developmentFolder,
  };
}

async function openShowService(
  context: () => StoreContext,
  log: Logger,
): Promise<ShowService | null> {
  try {
    const loaded = await loadStore(context());
    if (!loaded.ok) {
      log.error('refused the data folder', loaded.error);
      return null;
    }
    logLoadedStore(loaded.value, log);
    return showServiceOf(loaded.value);
  } catch (error: unknown) {
    log.error('could not read the data folder', error);
    return null;
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
  if (store.appConfigBroken) {
    log.warn('app.json is broken, so the app never writes over it');
  }
  for (const problem of store.problems.slice(0, MAX_LOGGED_PROBLEMS)) {
    log.warn('skipped a data file or a part of one', problem);
  }
  const unlogged = store.problems.length - MAX_LOGGED_PROBLEMS;
  if (unlogged > 0) {
    log.warn(`skipped ${unlogged} more data files or parts of them`);
  }
}
