import {mkdir, readdir, writeFile} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {describe, expect, it, onTestFinished, vi} from 'vitest';
import type {
  LibraryLocationField,
  LocationsView,
} from '@core/schema/libraryLocations';
import {defaultPreferences} from '@core/schema/preferences';
import type {Logger} from '@main/log';
import {BackupGate, backupFolderName} from '@main/store/backup';
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
  const gate = new BackupGate();
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
    gate,
  });
  onTestFinished(locations.watchBackups());
  const choosing = (folder: string | null): FolderChooser =>
    vi.fn(() => Promise.resolve(folder));
  return {root, inUse, config, locations, onChange, log, choosing, gate};
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

  it.each([
    {
      name: 'a backup folder inside the songs folder',
      field: 'backupPath',
      base: 'songs',
      child: 'Backups',
    },
    {
      name: 'a backup folder that is the data folder',
      field: 'backupPath',
      base: 'dataRoot',
      child: '',
    },
    {
      name: 'a backup folder inside the media folder',
      field: 'backupPath',
      base: 'media',
      child: 'B',
    },
    {
      name: 'a backup folder holding the songs folder',
      field: 'backupPath',
      base: 'parent',
      child: '',
    },
    {
      name: 'a songs folder inside the backup folder',
      field: 'songsPath',
      base: 'backups',
      child: 'S',
    },
    {
      name: 'a media folder that is the backup folder',
      field: 'mediaPath',
      base: 'backups',
      child: '',
    },
  ] as const)(
    'refuses $name and stores nothing',
    async ({field, base, child}) => {
      const {inUse, locations, config, onChange, choosing} = await setUp();
      const parent = dirname(inUse.dataRoot);
      const folders = {...inUse, parent};
      const folder = child === '' ? folders[base] : join(folders[base], child);

      const result = await locations.choose(field, choosing(folder));

      expect(result).toEqual({ok: false, error: {reason: 'overlaps-backup'}});
      expect(config.libraryLocations).toEqual({});
      expect(onChange).not.toHaveBeenCalled();
    },
  );

  it('refuses a folder that differs only in letter case on Windows', async () => {
    const {inUse, locations, choosing} = await setUp();

    const result = await locations.choose(
      'backupPath',
      choosing(inUse.songs.toUpperCase()),
    );

    expect(result.ok).toBe(process.platform !== 'win32');
  });

  it('accepts a sibling folder of the data and backup folders', async () => {
    const {root, locations, config, choosing} = await setUp();

    const result = await locations.choose(
      'backupPath',
      choosing(join(root, 'ElsewhereBackups')),
    );

    expect(result).toEqual({ok: true, value: undefined});
    expect(config.libraryLocations.backupPath).toBe(
      join(root, 'ElsewhereBackups'),
    );
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
    await vi.waitFor(() =>
      expect(onChange.mock.calls.at(-1)?.[0].backingUp).toBe(false),
    );
    expect(onChange.mock.calls.some(([view]) => view.backingUp)).toBe(true);
    expect((await locations.view()).lastBackup).toBe(NOW.getTime());
  });

  it('refuses while the launch backup holds the gate, and shows it running', async () => {
    const {locations, onChange, gate} = await setUp();

    expect(gate.enter()).toBe(true);
    const view = await locations.view();
    const refused = await locations.backUpNow();
    gate.leave();

    expect(view.backingUp).toBe(true);
    expect(refused).toEqual({ok: false, error: {reason: 'running'}});
    await vi.waitFor(() =>
      expect(onChange.mock.calls.at(-1)?.[0].backingUp).toBe(false),
    );
    expect(onChange.mock.calls.some(([next]) => next.backingUp)).toBe(true);
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
