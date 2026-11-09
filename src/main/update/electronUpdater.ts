import type {AppUpdater} from 'electron-updater';
import {app} from 'electron';
import {parseUpdateVersion} from '@core/schema/update';
import type {Logger} from '../log';
import type {UpdaterPort} from './port';

/** Creates the sole electron-updater adapter, only for an installed Windows app. */
export function createUpdater(log: Logger): UpdaterPort {
  let disposed = false;
  let loaded: Promise<AppUpdater> | undefined;
  let updater: AppUpdater | undefined;
  const get = (): Promise<AppUpdater> => {
    loaded ??= import('electron-updater').then(({default: electronUpdater}) => {
      if (disposed) throw new Error('Updater stopped');
      updater = electronUpdater.autoUpdater;
      configure(updater, log);
      return updater;
    });
    return loaded;
  };
  return {
    async check() {
      const autoUpdater = await get();
      const result = await autoUpdater.checkForUpdates();
      if (result === null) throw new Error('Update check unavailable');
      if (!result.isUpdateAvailable) return null;
      const version = parseUpdateVersion(result.updateInfo.version);
      if (!version.ok) throw new Error('Invalid release version');
      return version.value;
    },
    async download(progress) {
      const autoUpdater = await get();
      const onProgress = (value: {percent: number}): void => {
        if (!disposed && Number.isFinite(value.percent)) {
          progress(Math.max(0, Math.min(100, Math.round(value.percent))));
        }
      };
      autoUpdater.on('download-progress', onProgress);
      try {
        await autoUpdater.downloadUpdate();
      } finally {
        autoUpdater.removeListener('download-progress', onProgress);
      }
    },
    install: () => updater?.quitAndInstall(true, true),
    dispose: () => {
      disposed = true;
    },
  };
}

function configure(autoUpdater: AppUpdater, log: Logger): void {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease = false;
  autoUpdater.allowDowngrade = false;
  autoUpdater.logger = {
    info: (message: unknown) => log.info(String(message)),
    warn: (message: unknown) => log.warn(String(message)),
    error: (message: unknown) => log.error(String(message)),
    debug: (message: unknown) => log.debug?.(String(message)),
  };
  const onError = (error: Error): void => log.warn('Update failed', error);
  autoUpdater.on('error', onError);
  // NOTE(0913vision): A download or installer can emit an error after the UI
  // channels close. Keep that one listener until Electron actually quits.
  app.once('will-quit', () => autoUpdater.removeListener('error', onError));
}
