import {mkdir, readdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it, vi} from 'vitest';
import type {
  LibraryLocationField,
  LocationsView,
} from '@core/schema/libraryLocations';
import {defaultPreferences} from '@core/schema/preferences';
import type {Logger} from '@main/log';
import {backupFolderName} from '@main/store/backup';
import {
  LibraryLocations,
  type FolderChooser,
  type LocationsConfig,
} from '@main/store/libraryLocations';
import {resolveLocations, type LocationFields} from '@main/store/locations';
import {makeTempDir} from '@fixtures/tempDir';

const NOW = new Date(2026, 10, 2, 7, 58, 0);

async function setUp({
  readOnly = false,
  outputOn = false,
}: {readonly readOnly?: boolean; readonly outputOn?: boolean} = {}) {
  const root = await makeTempDir();
  const context = {documents: join(root, 'unused'), developmentFolder: root};
  const inUse = resolveLocations({}, context).locations;
  let stored: LocationFields = {};
  const config: LocationsConfig = {
    get libraryLocations() {
      return stored;
    },
    isReadOnly: readOnly,
    setLibraryLocation: (field: LibraryLocationField, folder: string) => {
      stored = {...stored, [field]: folder};
    },
  };
  const log = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    flush: () => Promise.resolve(),
  } satisfies Logger;
  const onChange = vi.fn<(view: LocationsView) => void>();
  const locations = new LibraryLocations({
    config,
    inUse,
    context: () => context,
    backupPreferences: () => Promise.resolve(defaultPreferences.backup),
    isAnyOutputOn: () => outputOn,
    onChange,
    log,
    now: () => NOW,
  });
  const choosing = (folder: string | null): FolderChooser =>
    vi.fn(() => Promise.resolve(folder));
  return {root, inUse, config, locations, onChange, log, choosing};
}

describe('the folders shown', () => {
  it('shows the default folders, none pending, and no last backup', async () => {
    const {locations, inUse} = await setUp();

    expect(await locations.view()).toEqual({
      songs: {path: inUse.songs, pending: false},
      media: {path: inUse.media, pending: false},
      backup: {path: inUse.backups, pending: false},
      lastBackup: null,
      backingUp: false,
    });
  });

  it('takes the last backup from the newest complete folder and ignores partial ones', async () => {
    const {locations, inUse} = await setUp();
    await mkdir(join(inUse.backups, '2026-10-31_070000'), {recursive: true});
    await mkdir(join(inUse.backups, '2026-11-01_081500'), {recursive: true});
    await mkdir(join(inUse.backups, '2026-11-02_075800.partial'), {
      recursive: true,
    });

    const {lastBackup} = await locations.view();

    expect(lastBackup).toBe(new Date(2026, 10, 1, 8, 15, 0).getTime());
  });
});

describe('choosing a folder', () => {
  it('stores a writable folder, marks 곡 as waiting for the next launch, and publishes', async () => {
    const {root, locations, onChange, choosing} = await setUp();
    const folder = join(root, 'MySongs');

    const result = await locations.choose('songsPath', choosing(folder));

    expect(result).toEqual({ok: true, value: undefined});
    const view = await locations.view();
    expect(view.songs).toEqual({path: folder, pending: true});
    expect(onChange).toHaveBeenCalledWith(view);
  });

  it('applies a new 백업 위치 to the next backup without waiting', async () => {
    const {root, locations, choosing} = await setUp();
    const folder = join(root, 'MyBackups');

    await locations.choose('backupPath', choosing(folder));

    expect((await locations.view()).backup).toEqual({
      path: folder,
      pending: false,
    });
    expect(await locations.backUpNow()).toEqual({ok: true, value: undefined});
    expect(await readdir(folder)).toEqual([backupFolderName(NOW)]);
  });

  it('leaves the files of the old folder where they are', async () => {
    const {root, inUse, locations, choosing} = await setUp();
    await mkdir(inUse.songs, {recursive: true});
    await writeFile(join(inUse.songs, 'a.llsong'), 'x');

    await locations.choose('songsPath', choosing(join(root, 'MySongs')));

    expect(await readdir(inUse.songs)).toEqual(['a.llsong']);
    expect(await readdir(join(root, 'MySongs'))).toEqual([]);
  });

  it('refuses a folder that cannot be written and stores nothing', async () => {
    const {root, locations, config, onChange, choosing} = await setUp();
    const file = join(root, 'a-file');
    await writeFile(file, 'x');

    const result = await locations.choose(
      'mediaPath',
      choosing(join(file, 'in')),
    );

    expect(result).toMatchObject({
      ok: false,
      error: {reason: 'not-writable'},
    });
    expect(config.libraryLocations).toEqual({});
    expect(onChange).not.toHaveBeenCalled();
  });

  it('refuses a folder outside the development folder', async () => {
    const {locations, config, choosing} = await setUp();
    const outside = join(await makeTempDir(), 'Songs');

    const result = await locations.choose('songsPath', choosing(outside));

    expect(result).toEqual({
      ok: false,
      error: {reason: 'outside-development'},
    });
    expect(config.libraryLocations).toEqual({});
  });

  it('stores nothing when the dialog is canceled', async () => {
    const {locations, config, choosing} = await setUp();

    expect(await locations.choose('songsPath', choosing(null))).toEqual({
      ok: false,
      error: {reason: 'canceled'},
    });
    expect(config.libraryLocations).toEqual({});
  });

  it('refuses to change a file of a newer version without opening the dialog', async () => {
    const {locations, choosing} = await setUp({readOnly: true});
    const chooser = choosing('C:\\data\\unused');

    expect(await locations.choose('songsPath', chooser)).toEqual({
      ok: false,
      error: {reason: 'settings-locked'},
    });
    expect(chooser).not.toHaveBeenCalled();
  });
});

describe('지금 백업', () => {
  it('shows that it runs, refuses a second one, and ends with the new last backup', async () => {
    const {locations, onChange} = await setUp();

    const first = locations.backUpNow();
    const second = await locations.backUpNow();
    const finished = await first;

    expect(second).toEqual({ok: false, error: {reason: 'running'}});
    expect(finished).toEqual({ok: true, value: undefined});
    const states = onChange.mock.calls.map(([view]) => view.backingUp);
    expect(states[0]).toBe(true);
    expect(states.at(-1)).toBe(false);
    expect((await locations.view()).lastBackup).toBe(NOW.getTime());
  });

  it('does not back up while an output is on', async () => {
    const {locations} = await setUp({outputOn: true});

    expect(await locations.backUpNow()).toEqual({
      ok: false,
      error: {reason: 'output-on'},
    });
    expect((await locations.view()).lastBackup).toBeNull();
  });
});
