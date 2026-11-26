import {describe, expect, it, vi} from 'vitest';
import {app, autoUpdater as electronAutoUpdater} from 'electron';
import electronUpdater from 'electron-updater';
import {createUpdater} from '@main/update/electronUpdater';
import {recordingLogger} from '@fixtures/main/displays/testing';

vi.mock('electron', async () => {
  const {EventEmitter} = await import('node:events');
  return {app: new EventEmitter(), autoUpdater: new EventEmitter()};
});
vi.mock('electron-updater', async () => {
  const {EventEmitter} = await import('node:events');
  return {
    default: {
      autoUpdater: Object.assign(new EventEmitter(), {
        autoDownload: true,
        autoInstallOnAppQuit: true,
        checkForUpdates: vi.fn(),
        downloadUpdate: vi.fn(),
        quitAndInstall: vi.fn(),
      }),
    },
  };
});

describe('electron updater adapter', () => {
  it('disables quit installation, validates versions and installs only on an explicit call', async () => {
    const {autoUpdater} = electronUpdater;
    const port = createUpdater(recordingLogger());
    vi.mocked(autoUpdater.checkForUpdates).mockResolvedValue(null);
    await expect(port.check()).rejects.toThrow('unavailable');
    expect(autoUpdater.autoDownload).toBe(false);
    expect(autoUpdater.autoInstallOnAppQuit).toBe(false);
    vi.mocked(autoUpdater.downloadUpdate).mockImplementation(async () => {
      autoUpdater.emit('download-progress', {
        percent: 47.8,
        total: 1000,
        delta: 478,
        transferred: 478,
        bytesPerSecond: 478,
      });
      return [];
    });
    const progress = vi.fn();
    await port.download(progress);
    expect(progress).toHaveBeenCalledExactlyOnceWith(48);
    expect(autoUpdater.listenerCount('download-progress')).toBe(0);
    expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled();
    vi.mocked(autoUpdater.quitAndInstall).mockImplementation(() => {
      electronAutoUpdater.emit('before-quit-for-update');
    });
    await port.install();
    expect(autoUpdater.quitAndInstall).toHaveBeenCalledExactlyOnceWith(
      true,
      true,
    );
    port.dispose();
    app.emit('will-quit');
    expect(autoUpdater.listenerCount('error')).toBe(0);
  });

  it('logs the fall back from a differential download to the whole installer as a warning, other updater errors as errors', async () => {
    const {autoUpdater} = electronUpdater;
    const log = recordingLogger();
    const port = createUpdater(log);
    vi.mocked(autoUpdater.checkForUpdates).mockResolvedValue(null);
    await expect(port.check()).rejects.toThrow('unavailable');
    const {logger} = autoUpdater;
    if (logger === null) throw new Error('No updater logger');
    logger.error(
      'Cannot download differentially, fallback to full download: Error: sha512 checksum mismatch',
    );
    logger.error('Error: net::ERR_CONNECTION_RESET');
    expect(log.messages('warn')).toEqual([
      expect.stringMatching(/^Cannot download differentially/),
    ]);
    expect(log.messages('error')).toEqual(['Error: net::ERR_CONNECTION_RESET']);
    port.dispose();
    app.emit('will-quit');
  });

  it('rejects an installer launch error before the update handoff', async () => {
    const {autoUpdater} = electronUpdater;
    const port = createUpdater(recordingLogger());
    vi.mocked(autoUpdater.checkForUpdates).mockResolvedValue(null);
    await expect(port.check()).rejects.toThrow('unavailable');
    vi.mocked(autoUpdater.quitAndInstall).mockImplementation(() => {
      autoUpdater.emit('error', new Error('Installer unavailable'));
    });
    await expect(port.install()).rejects.toThrow('Installer unavailable');
    expect(electronAutoUpdater.listenerCount('before-quit-for-update')).toBe(0);
    port.dispose();
    app.emit('will-quit');
  });
});
