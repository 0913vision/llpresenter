import {resolve} from 'node:path';
import {describe, expect, it, vi} from 'vitest';
import type {FileError} from '@core/schema/fileFormat';
import type {BackupOutcome, BackupsOptions} from '@main/store/backup';
import {resolveLocations} from '@main/store/locations';
import {settingsLocation} from '@main/store/settingsFile';
import {removeStaleTempFiles} from '@main/store/staleTempFiles';
import {logLoadedStore, upkeepAtLaunch} from '@main/store/storeUpkeep';
import {recordingLogger} from '@fixtures/main/displays/testing';

const backups = vi.hoisted(() => {
  const state: {
    options: BackupsOptions[];
    outcome: () => Promise<BackupOutcome>;
    order: string[];
  } = {
    options: [],
    outcome: () => Promise.resolve({kind: 'skipped', reason: 'auto-off'}),
    order: [],
  };
  return state;
});

vi.mock('@main/store/backup', () => ({
  Backups: class {
    constructor(options: BackupsOptions) {
      backups.options.push(options);
    }
    atLaunch() {
      backups.order.push('backup');
      return backups.outcome();
    }
  },
}));
vi.mock('@main/store/staleTempFiles', () => ({
  removeStaleTempFiles: vi.fn(),
}));

const {locations} = resolveLocations(
  {},
  {documents: resolve('/upkeep-tests'), developmentFolder: null},
);

function store() {
  return {
    locations,
    developmentFolder: null,
    preferences: {backup: {auto: true, keep: 7}},
  };
}

function setup(outcome?: () => Promise<BackupOutcome>) {
  backups.options.length = 0;
  backups.order.length = 0;
  if (outcome !== undefined) backups.outcome = outcome;
  vi.mocked(removeStaleTempFiles).mockImplementation(folder => {
    backups.order.push(folder);
    return Promise.resolve([]);
  });
  return recordingLogger();
}

describe('upkeepAtLaunch', () => {
  it('defers all upkeep to readiness and waits for an already started backup', async () => {
    let release: (ready: boolean) => void = () => undefined;
    const launchIdle = new Promise<boolean>(resolve => {
      release = resolve;
    });
    let finish: (value: BackupOutcome) => void = () => undefined;
    const log = setup(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    const done = vi.fn();
    const work = upkeepAtLaunch(Promise.resolve(store()), () => false, {
      log,
      launchIdle,
    });
    void work.then(done, done);
    await Promise.resolve();
    expect(backups.order).toEqual([]);
    release(true);
    await vi.waitFor(() => expect(backups.order).toContain('backup'));
    expect(done).not.toHaveBeenCalled();
    finish({kind: 'skipped', reason: 'auto-off'});
    await work;
    expect(done).toHaveBeenCalledOnce();
    backups.outcome = () =>
      Promise.resolve({kind: 'skipped', reason: 'auto-off'});
  });

  it('cancels a deferred backup on early shutdown', async () => {
    const log = setup();
    await upkeepAtLaunch(Promise.resolve(store()), () => false, {
      log,
      launchIdle: Promise.resolve(false),
    });
    expect(backups.order).toEqual([]);
  });
  it('does nothing without a loaded store', async () => {
    const log = setup();

    await upkeepAtLaunch(Promise.resolve(null), () => false, {log});

    expect(backups.order).toEqual([]);
  });

  it('removes leftover temporary files in every data folder before the backup', async () => {
    const log = setup();

    await upkeepAtLaunch(Promise.resolve(store()), () => false, {log});

    expect(backups.order).toEqual([
      locations.songs,
      locations.services,
      locations.templates,
      locations.settings,
      'backup',
    ]);
  });

  it('logs each temporary file it could not remove and still backs up', async () => {
    const log = setup();
    vi.mocked(removeStaleTempFiles).mockResolvedValueOnce([
      {file: 'a.tmp', message: 'busy'},
    ]);

    await upkeepAtLaunch(Promise.resolve(store()), () => false, {log});

    expect(log.messages('warn')).toEqual([
      'could not remove a leftover temporary file',
    ]);
    expect(backups.options).toHaveLength(1);
  });

  it('gives the backup the folders, the output check, and the backup preferences', async () => {
    const log = setup();
    const isAnyOutputOn = vi.fn(() => true);

    await upkeepAtLaunch(Promise.resolve(store()), isAnyOutputOn, {log});

    const [options] = backups.options;
    expect(options).toMatchObject({locations, developmentFolder: null});
    expect(options?.preferences()).toEqual({auto: true, keep: 7});
    expect(options?.isAnyOutputOn()).toBe(true);
  });

  it.each<[BackupOutcome, string, string[]]>([
    [
      {
        kind: 'done',
        backup: {folder: 'backup-1', problems: [{file: 'old', message: 'x'}]},
      },
      'backed up the data',
      ['could not delete an old backup'],
    ],
    [{kind: 'skipped', reason: 'output-on'}, 'skipped the launch backup', []],
    [
      {kind: 'failed', problem: {file: 'copy', message: 'x'}},
      '',
      ['the launch backup failed'],
    ],
  ])('logs the backup outcome %j', async (outcome, info, warnings) => {
    const log = setup(() => Promise.resolve(outcome));

    await upkeepAtLaunch(Promise.resolve(store()), () => false, {log});

    expect(log.messages('info')).toEqual(info === '' ? [] : [info]);
    expect(log.messages('warn')).toEqual(warnings);
  });

  it('reports the backup folder when the launch backup fails or throws, and not when it works or is skipped', async () => {
    const failed = vi.fn();
    const outcomes: BackupOutcome[] = [
      {kind: 'failed', problem: {file: 'copy', message: 'x'}},
      {kind: 'skipped', reason: 'output-on'},
      {kind: 'done', backup: {folder: 'backup-1', problems: []}},
    ];
    for (const outcome of outcomes) {
      const log = setup(() => Promise.resolve(outcome));
      await upkeepAtLaunch(Promise.resolve(store()), () => false, {
        log,
        onBackupFailed: failed,
      });
    }
    expect(failed).toHaveBeenCalledExactlyOnceWith(locations.backups);

    failed.mockClear();
    const log = setup(() => Promise.reject(new Error('disk')));
    await upkeepAtLaunch(Promise.resolve(store()), () => false, {
      log,
      onBackupFailed: failed,
    });
    expect(failed).toHaveBeenCalledExactlyOnceWith(locations.backups);
  });

  it('logs a backup that throws as an error', async () => {
    const log = setup(() => Promise.reject(new Error('disk')));

    await upkeepAtLaunch(Promise.resolve(store()), () => false, {log});

    expect(log.messages('error')).toEqual(['the launch backup failed']);
  });
});

describe('logLoadedStore', () => {
  function problem(file: string): FileError {
    return {kind: 'json', file, field: '', message: 'Broken JSON'};
  }

  it('logs the summary and at most 50 content problems, counting the rest', () => {
    const log = recordingLogger();
    const problems = Array.from({length: 52}, (_, index) =>
      problem(resolve(locations.songs, `${index}.llsong`)),
    );

    logLoadedStore(
      {
        locations,
        problems,
        openServiceId: null,
        songs: {size: 3},
        services: {size: 1},
      },
      log,
    );

    expect(log.entries[0]).toEqual({
      level: 'info',
      message: 'read the data folder',
      detail: {
        dataRoot: locations.dataRoot,
        songs: 3,
        services: 1,
        openServiceId: null,
      },
    });
    expect(log.messages('warn')).toHaveLength(51);
    expect(log.messages('warn').at(-1)).toBe(
      'skipped 2 more data files or parts of them',
    );
  });

  it('leaves out the settings and media problems that their own feeds report', () => {
    const log = recordingLogger();

    logLoadedStore(
      {
        locations,
        problems: [
          problem(settingsLocation(locations, 'macros').file),
          problem(settingsLocation(locations, 'media').file),
          problem(resolve(locations.songs, 'a.llsong')),
        ],
        openServiceId: null,
        songs: {size: 0},
        services: {size: 0},
      },
      log,
    );

    expect(log.messages('warn')).toEqual([
      'skipped a data file or a part of one',
    ]);
  });
});
