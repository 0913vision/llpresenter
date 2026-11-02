import {BrowserWindow, dialog, ipcMain, type OpenDialogOptions} from 'electron';
import {locationsEndpoints} from '@contracts/ipc/locations';
import {
  parseBackUpNowRequest,
  parseChooseLocationRequest,
} from '@core/schema/libraryLocations';
import {
  defaultPreferences,
  withPreferenceDefaults,
} from '@core/schema/preferences';
import type {Logger} from '../log';
import {broadcast} from './contentChannels';
import {
  LibraryLocations,
  type FolderChooser,
  type LocationsConfig,
} from './libraryLocations';
import {resolveLocations, type LocationFields} from './locations';
import {electronLocationContext} from './register';
import type {SettingsAccess} from './settingsAccess';

/**
 * Answers the 위치 and 백업 calls of 환경설정. The folder dialog is parented
 * to the window that asked, so it never opens behind it.
 *
 * @returns A function that removes the handlers.
 */
export function registerLocationsChannels(
  locations: LibraryLocations,
  log: Logger,
): () => void {
  const {get, choose, backUpNow} = locationsEndpoints;
  ipcMain.handle(get.channel, () => locations.view());
  ipcMain.handle(choose.channel, (event, value: unknown) => {
    const request = parseChooseLocationRequest(value);
    if (!request.ok) {
      log.warn('dropped a malformed folder request', request.error);
      throw new Error('Invalid folder request');
    }
    const parent = BrowserWindow.fromWebContents(event.sender);
    const chooser: FolderChooser = async current => {
      const options: OpenDialogOptions = {
        defaultPath: current,
        properties: ['openDirectory', 'createDirectory'],
      };
      const answer =
        parent === null
          ? await dialog.showOpenDialog(options)
          : await dialog.showOpenDialog(parent, options);
      return answer.canceled ? null : (answer.filePaths[0] ?? null);
    };
    return locations.choose(request.value.field, chooser);
  });
  ipcMain.handle(backUpNow.channel, (_event, value: unknown) => {
    const request = parseBackUpNowRequest(value);
    if (!request.ok) {
      log.warn('dropped a malformed backup request', request.error);
      throw new Error('Invalid backup request');
    }
    return locations.backUpNow();
  });
  return () => {
    ipcMain.removeHandler(get.channel);
    ipcMain.removeHandler(choose.channel);
    ipcMain.removeHandler(backUpNow.channel);
  };
}

/** Pushes the folders to every window after a change. */
export function broadcastLocations(log: Logger) {
  return (view: unknown): void =>
    broadcast(locationsEndpoints.changed.channel, view, log);
}

/**
 * Builds the folder rules of 환경설정 from `app.json` and the preferences, and
 * answers their calls.
 *
 * @returns A function that removes the handlers.
 */
export function registerLibraryLocations({
  config,
  settings,
  isAnyOutputOn,
  log,
}: {
  readonly config: LocationsConfig & {readonly locationFields: LocationFields};
  readonly settings: Pick<SettingsAccess, 'readSettings'>;
  readonly isAnyOutputOn: () => boolean;
  readonly log: Logger;
}): () => void {
  const locations = new LibraryLocations({
    config,
    inUse: resolveLocations(config.locationFields, electronLocationContext())
      .locations,
    context: electronLocationContext,
    backupPreferences: async () => {
      const document = await settings.readSettings('preferences');
      return document?.name === 'preferences'
        ? withPreferenceDefaults(document.value).backup
        : defaultPreferences.backup;
    },
    isAnyOutputOn,
    onChange: broadcastLocations(log),
    log,
  });
  return registerLocationsChannels(locations, log);
}
