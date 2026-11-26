import {join} from 'node:path';
import {expect, it, onTestFinished, vi} from 'vitest';
import {locationsEndpoints} from '@contracts/ipc/locations';
import type {LibraryLocationField} from '@core/schema/app/libraryLocations';
import {defaultPreferences} from '@core/schema/app/preferences';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {makeTempDir} from '@fixtures/tempDir';
import {
  LibraryLocations,
  type LocationsConfig,
} from '@main/store/locations/libraryLocations';
import {registerLocationsChannels} from '@main/store/locations/locationsChannels';
import {resolveLocations} from '@main/store/locations/locations';

const ipc = await vi.hoisted(async () =>
  (await import('@fixtures/main/base/mockIpcMain')).mockIpcMain(),
);
const electron = vi.hoisted(() => ({
  parent: {id: 'settings window'},
  showOpenDialog:
    vi.fn<
      (
        parent: unknown,
        options: {readonly defaultPath?: string; readonly properties: string[]},
      ) => Promise<{canceled: boolean; filePaths: string[]}>
    >(),
}));
vi.mock('electron', () => ({
  ipcMain: ipc.ipcMain,
  app: {getPath: () => ''},
  shell: {},
  BrowserWindow: {
    fromWebContents: () => electron.parent,
    getAllWindows: () => [],
  },
  dialog: {showOpenDialog: electron.showOpenDialog},
}));

async function setUp() {
  const root = await makeTempDir();
  const context = {documents: join(root, 'unused'), developmentFolder: root};
  const stored: Partial<Record<LibraryLocationField, string>> = {};
  const config: LocationsConfig = {
    get libraryLocations() {
      return stored;
    },
    isReadOnly: false,
    setLibraryLocation: (field, folder) => {
      stored[field] = folder;
    },
  };
  const log = recordingLogger();
  const locations = new LibraryLocations({
    config,
    inUse: resolveLocations({}, context).locations,
    context: () => context,
    backupPreferences: () => Promise.resolve(defaultPreferences.backup),
    isAnyOutputOn: () => false,
    onChange: vi.fn(),
    log,
  });
  const stop = registerLocationsChannels(locations, log);
  onTestFinished(() => {
    stop();
    ipc.reset();
  });
  const songs = resolveLocations({}, context).locations.songs;
  return {root, stored, locations, stop, songs};
}

it('shows the folders of 환경설정 as the locations see them', async () => {
  const {locations} = await setUp();
  expect(await ipc.answer(locationsEndpoints.get)).toEqual(
    await locations.view(),
  );
});

it('asks for a folder over the window that asked, starting at the folder in use, and keeps a chosen one', async () => {
  const {root, stored, songs} = await setUp();
  const chosen = join(root, 'songs-elsewhere');
  electron.showOpenDialog.mockResolvedValueOnce({
    canceled: false,
    filePaths: [chosen],
  });
  await expect(
    ipc.answer(locationsEndpoints.choose, {field: 'songsPath'}),
  ).resolves.toEqual({ok: true, value: undefined});
  expect(electron.showOpenDialog).toHaveBeenCalledWith(electron.parent, {
    defaultPath: songs,
    properties: ['openDirectory', 'createDirectory'],
  });
  expect(stored.songsPath).toBe(chosen);
});

it('changes nothing when the folder dialog is canceled', async () => {
  const {stored} = await setUp();
  electron.showOpenDialog.mockResolvedValueOnce({
    canceled: true,
    filePaths: [],
  });
  await expect(
    ipc.answer(locationsEndpoints.choose, {field: 'mediaPath'}),
  ).resolves.toEqual({ok: false, error: {reason: 'canceled'}});
  expect(stored).toEqual({});
});

it('stops answering once it is stopped', async () => {
  const {stop} = await setUp();
  stop();
  expect(ipc.has(locationsEndpoints.get.channel)).toBe(false);
  expect(ipc.has(locationsEndpoints.choose.channel)).toBe(false);
  expect(ipc.has(locationsEndpoints.backUpNow.channel)).toBe(false);
});
