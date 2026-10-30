import {mkdir, readdir, readFile, rm, symlink} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {describe, expect, it, onTestFinished} from 'vitest';
import {makeTempDir} from '../../../test/temp-dir';
import {
  backupFolderName,
  Backups,
  lastBackupTime,
  runBackup,
  type BackupsOptions,
} from './backup';
import {resolveLocations, type DataLocations} from './locations';
import {writeJson} from './testFiles';

const NOW = new Date(2026, 9, 25, 7, 58, 0);
const NOW_NAME = '2026-10-25_075800';
const YESTERDAY_NAME = '2026-10-24_210000';

async function dataLocations(): Promise<DataLocations> {
  const folder = await makeTempDir();
  return resolveLocations(
    {},
    {documents: join(folder, 'unused'), developmentFolder: folder},
  ).locations;
}

async function backupNames(locations: DataLocations): Promise<string[]> {
  return (await readdir(locations.backups)).sort();
}

function developmentFolderOf(locations: DataLocations): string {
  return dirname(locations.dataRoot);
}

function backUp(locations: DataLocations, keep = 30) {
  return runBackup({
    locations,
    keep,
    now: NOW,
    developmentFolder: developmentFolderOf(locations),
  });
}

function backups(
  locations: DataLocations,
  options: Partial<BackupsOptions> = {},
): Backups {
  return new Backups({
    locations,
    developmentFolder: developmentFolderOf(locations),
    preferences: () => ({auto: true, keep: 30}),
    isAnyOutputOn: () => false,
    now: () => NOW,
    ...options,
  });
}

describe('backupFolderName', () => {
  it('names a backup after the local time', () => {
    expect(backupFolderName(NOW)).toBe(NOW_NAME);
    expect(backupFolderName(new Date(2027, 0, 2, 3, 4, 5))).toBe(
      '2027-01-02_030405',
    );
  });
});

describe('runBackup', () => {
  it('copies songs, services, 템플릿, and settings, and leaves out media', async () => {
    const locations = await dataLocations();
    await writeJson(join(locations.songs, 'a.llsong'), {title: 'a'});
    await writeJson(join(locations.services, 'b.llservice'), {name: 'b'});
    await writeJson(join(locations.settings, 'labels.json'), {labels: []});
    await writeJson(join(locations.media, 'video.mp4'), 'large');
    await writeJson(join(locations.recovery, 'song', 'x.json'), 'copy');

    const backup = await backUp(locations, 30);

    const folder = join(locations.backups, NOW_NAME);
    expect(backup).toEqual({ok: true, value: {folder, problems: []}});
    expect((await readdir(folder)).sort()).toEqual([
      'Services',
      'Settings',
      'Songs',
    ]);
    expect(await readFile(join(folder, 'Songs', 'a.llsong'), 'utf8')).toBe(
      '{"title":"a"}',
    );
    expect(await backupNames(locations)).toEqual([NOW_NAME]);
  });

  it('keeps the newest backups and removes cut-off ones, and nothing else', async () => {
    const locations = await dataLocations();
    const older = ['2026-10-20_070000', '2026-10-21_070000'];
    for (const name of [...older, '2026-10-22_070000.partial', '내 백업']) {
      await mkdir(join(locations.backups, name), {recursive: true});
    }

    await backUp(locations, 2);

    expect(await backupNames(locations)).toEqual([
      '2026-10-21_070000',
      NOW_NAME,
      '내 백업',
    ]);
  });

  it('leaves files, links, and other names alone when it deletes old backups', async () => {
    const locations = await dataLocations();
    const elsewhere = await makeTempDir();
    await writeJson(join(elsewhere, 'keep.txt'), 'not a backup');
    const link = join(locations.backups, '2026-10-03_070000');
    await mkdir(join(locations.backups, '2026-13-40_250000'), {
      recursive: true,
    });
    await writeJson(join(locations.backups, '2026-10-01_070000'), 'a file');
    await writeJson(join(locations.backups, '2026-10-02_070000.partial'), 'x');
    await symlink(elsewhere, link, 'junction');
    onTestFinished(() => rm(link, {force: true}));

    await backUp(locations, 1);

    expect(await backupNames(locations)).toEqual([
      '2026-10-01_070000',
      '2026-10-02_070000.partial',
      '2026-10-03_070000',
      NOW_NAME,
      '2026-13-40_250000',
    ]);
    expect(await readdir(elsewhere)).toEqual(['keep.txt']);
  });

  it('copies what a linked data folder holds, so the backup stands alone', async () => {
    const folder = await makeTempDir();
    const original = join(folder, 'songs');
    const link = join(folder, 'songs-link');
    await writeJson(join(original, 'a.llsong'), {title: 'a'});
    await symlink(original, link, 'junction');
    onTestFinished(() => rm(link, {force: true}));
    const {locations} = resolveLocations(
      {songsPath: link},
      {documents: join(folder, 'unused'), developmentFolder: folder},
    );

    await backUp(locations, 30);
    await rm(original, {recursive: true, force: true});

    const copy = join(locations.backups, NOW_NAME, 'Songs', 'a.llsong');
    expect(await readFile(copy, 'utf8')).toBe('{"title":"a"}');
  });

  it('fails in development when a link under 곡 leads outside LLP_USER_DATA', async () => {
    const locations = await dataLocations();
    const outside = await makeTempDir();
    await writeJson(join(outside, 'real.llsong'), {title: 'real data'});
    await writeJson(join(locations.songs, 'a.llsong'), {title: 'a'});
    const link = join(locations.songs, 'linked');
    await symlink(outside, link, 'junction');
    onTestFinished(() => rm(link, {force: true}));

    const backup = await backUp(locations);

    expect(backup.ok ? '' : backup.error.message).toContain(
      'outside LLP_USER_DATA',
    );
    expect(await backupNames(locations)).toEqual([]);
    expect(await readdir(outside)).toEqual(['real.llsong']);
  });

  it('follows the same link outside the development setup', async () => {
    const locations = await dataLocations();
    const outside = await makeTempDir();
    await writeJson(join(outside, 'real.llsong'), {title: 'real data'});
    const link = join(locations.songs, 'linked');
    await mkdir(locations.songs, {recursive: true});
    await symlink(outside, link, 'junction');
    onTestFinished(() => rm(link, {force: true}));

    const backup = await runBackup({
      locations,
      keep: 30,
      now: NOW,
      developmentFolder: null,
    });

    expect(backup.ok).toBe(true);
    const copy = join(
      locations.backups,
      NOW_NAME,
      'Songs',
      'linked',
      'real.llsong',
    );
    expect(await readFile(copy, 'utf8')).toBe('{"title":"real data"}');
  });

  it('refuses a file at the staging name and leaves it as it is', async () => {
    const locations = await dataLocations();
    const staging = join(locations.backups, `${NOW_NAME}.partial`);
    await writeJson(staging, 'not ours');

    const backup = await backUp(locations);

    expect(backup.ok).toBe(false);
    expect(await readFile(staging, 'utf8')).toBe('not ours');
  });

  it('refuses a link at the staging name and leaves it and its target', async () => {
    const locations = await dataLocations();
    const elsewhere = await makeTempDir();
    await writeJson(join(elsewhere, 'keep.txt'), 'not ours');
    await mkdir(locations.backups, {recursive: true});
    const staging = join(locations.backups, `${NOW_NAME}.partial`);
    await symlink(elsewhere, staging, 'junction');
    onTestFinished(() => rm(staging, {force: true}));

    const backup = await backUp(locations);

    expect(backup.ok).toBe(false);
    expect(await backupNames(locations)).toEqual([`${NOW_NAME}.partial`]);
    expect(await readdir(elsewhere)).toEqual(['keep.txt']);
  });

  it('leaves the temporary files of writes out of the backup', async () => {
    const locations = await dataLocations();
    const leftover = '.a.llsong.3b9d0c52-7e1f-4a2b-8c3d-4e5f60718293.tmp';
    await writeJson(join(locations.songs, 'a.llsong'), {title: 'a'});
    await writeJson(join(locations.songs, leftover), 'half written');

    await backUp(locations);

    expect(await readdir(join(locations.backups, NOW_NAME, 'Songs'))).toEqual([
      'a.llsong',
    ]);
    expect((await readdir(locations.songs)).sort()).toEqual(
      [leftover, 'a.llsong'].sort(),
    );
  });

  it('fails when a file stands where a data folder should be', async () => {
    const locations = await dataLocations();
    await writeJson(locations.songs, 'a file where the folder should be');

    const backup = await backUp(locations, 30);

    expect(backup.ok).toBe(false);
    expect(await backupNames(locations)).toEqual([]);
  });

  it('keeps at least one backup whatever the count says', async () => {
    const locations = await dataLocations();
    await mkdir(join(locations.backups, YESTERDAY_NAME), {recursive: true});

    await backUp(locations, 0);

    expect(await backupNames(locations)).toEqual([NOW_NAME]);
  });

  it('reports a backup location it cannot write and leaves nothing behind', async () => {
    const locations = await dataLocations();
    await writeJson(join(locations.songs, 'a.llsong'), {title: 'a'});
    const taken = join(locations.backups, NOW_NAME);
    await writeJson(join(taken, 'kept.txt'), 'already here');

    const backup = await backUp(locations, 30);

    expect(backup).toMatchObject({ok: false, error: {file: taken}});
    expect(await backupNames(locations)).toEqual([NOW_NAME]);
    expect(await readdir(taken)).toEqual(['kept.txt']);
  });
});

describe('lastBackupTime', () => {
  it('reads the time of the newest complete backup from its name', async () => {
    const locations = await dataLocations();
    for (const name of [YESTERDAY_NAME, `${NOW_NAME}.partial`, '내 백업']) {
      await mkdir(join(locations.backups, name), {recursive: true});
    }

    expect(await lastBackupTime(locations.backups)).toEqual({
      ok: true,
      value: new Date(2026, 9, 24, 21, 0, 0),
    });
  });

  it('counts only folders with a valid time as backups', async () => {
    const locations = await dataLocations();
    await writeJson(join(locations.backups, '2026-10-25_060000'), 'a file');
    await mkdir(join(locations.backups, '2026-02-30_060000'), {
      recursive: true,
    });

    expect(await lastBackupTime(locations.backups)).toEqual({
      ok: true,
      value: null,
    });
  });

  it('has none for an empty or missing backup location', async () => {
    const locations = await dataLocations();

    expect(await lastBackupTime(locations.backups)).toEqual({
      ok: true,
      value: null,
    });
  });
});

describe('Backups', () => {
  it('backs up at launch when the last backup is from an earlier day', async () => {
    const locations = await dataLocations();
    await mkdir(join(locations.backups, YESTERDAY_NAME), {recursive: true});

    const outcome = await backups(locations).atLaunch();

    expect(outcome.kind).toBe('done');
    expect(await backupNames(locations)).toEqual([YESTERDAY_NAME, NOW_NAME]);
  });

  it('backs up once a day at launch', async () => {
    const locations = await dataLocations();
    await mkdir(join(locations.backups, '2026-10-25_060000'), {
      recursive: true,
    });

    expect(await backups(locations).atLaunch()).toEqual({
      kind: 'skipped',
      reason: 'done-today',
    });
  });

  it('skips the launch backup when 자동 백업 is off, without reading the location', async () => {
    const locations = await dataLocations();
    await writeJson(locations.backups, 'a file where the folder should be');

    const outcome = await backups(locations, {
      preferences: () => ({auto: false, keep: 30}),
    }).atLaunch();

    expect(outcome).toEqual({kind: 'skipped', reason: 'auto-off'});
  });

  it('never starts a backup while an output is on', async () => {
    const locations = await dataLocations();
    const onAir = backups(locations, {isAnyOutputOn: () => true});

    expect(await onAir.atLaunch()).toEqual({
      kind: 'skipped',
      reason: 'output-on',
    });
    expect(await onAir.backUpNow()).toEqual({
      kind: 'skipped',
      reason: 'output-on',
    });
    expect(await readdir(join(locations.backups, '..'))).not.toContain(
      'LoveLightBackups',
    );
  });

  it('reports a backup that fails', async () => {
    const locations = await dataLocations();
    await writeJson(locations.backups, 'a file where the folder should be');

    const outcome = await backups(locations).backUpNow();

    expect(outcome).toMatchObject({
      kind: 'failed',
      problem: {file: join(locations.backups, NOW_NAME)},
    });
  });

  it('runs one backup at a time', async () => {
    const locations = await dataLocations();
    const runner = backups(locations);

    const [first, second] = await Promise.all([
      runner.backUpNow(),
      runner.backUpNow(),
    ]);

    expect(first.kind).toBe('done');
    expect(second).toEqual({kind: 'skipped', reason: 'running'});
  });
});
