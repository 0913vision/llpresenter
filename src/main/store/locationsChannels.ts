import {
  BrowserWindow,
  dialog,
  type OpenDialogOptions,
  type WebContents,
} from 'electron';
import {locationsEndpoints} from '@contracts/ipc/locations';
import {
  defaultPreferences,
  withPreferenceDefaults,
} from '@core/schema/preferences';
import {IpcHost, pushToWindows} from '../base/ipcHost';
import type {Logger} from '../base/log';
import {
  LibraryLocations,
  type FolderChooser,
  type LocationsConfig,
} from './libraryLocations';
import {resolveLocations, type LocationFields} from './locations';
import {electronLocationContext} from './register';
import type {SettingsAccess} from './settingsAccess';

/** Asks for a folder in a dialog on the window that asked. */
function folderChooser(contents: WebContents): FolderChooser {
  const parent = BrowserWindow.fromWebContents(contents);
  return async current => {
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
}

/**
 * Answers the 위치 and 백업 calls of 환경설정.
 *
 * @returns A function that stops answering.
 */
export function registerLocationsChannels(
  locations: LibraryLocations,
  log: Logger,
): () => void {
  const ipc = new IpcHost(log);
  ipc.query(locationsEndpoints.get, () => locations.view());
  ipc.request(locationsEndpoints.choose, ({field}, {contents}) =>
    locations.choose(field, folderChooser(contents)),
  );
  ipc.request(locationsEndpoints.backUpNow, () => locations.backUpNow());
  return () => {
    ipc.close();
  };
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
    onChange: view => {
      pushToWindows(locationsEndpoints.changed, view, log);
    },
    log,
  });
  const stopWatching = locations.watchBackups();
  const stopChannels = registerLocationsChannels(locations, log);
  return () => {
    stopWatching();
    stopChannels();
  };
}
