import type {AppUpdater} from 'electron-updater';
import {app, autoUpdater as electronAutoUpdater} from 'electron';
import {parseUpdateVersion} from '@core/schema/app/update';
import type {Logger} from '../base/log';
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
    async install() {
      if (updater === undefined || disposed) {
        throw new Error('Updater unavailable');
      }
      const current = updater;
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => finish(new Error('Installer did not start')),
          10000,
        );
        const finish = (error?: Error): void => {
          clearTimeout(timer);
          current.removeListener('error', failed);
          electronAutoUpdater.removeListener('before-quit-for-update', started);
          if (error === undefined) resolve();
          else reject(error);
        };
        const failed = (error: Error): void => finish(error);
        const started = (): void => finish();
        current.once('error', failed);
        electronAutoUpdater.once('before-quit-for-update', started);
        try {
          current.quitAndInstall(true, true);
        } catch (error) {
          finish(error instanceof Error ? error : new Error(String(error)));
        }
      });
    },
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
