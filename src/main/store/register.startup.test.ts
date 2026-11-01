import {
  ask,
  askForService,
  byName,
  developmentContext,
  disposers,
  electron,
  mockLog,
  mockProblems,
  register,
} from './testing/registerFixtures';
import {settingsEndpoints} from '@contracts/ipc/settings';
import type {AppProblem} from '@core/schema/appProblem';
import {readdir, rm, symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {makeTempDir} from '../../../test/temp-dir';
import {openAppConfig} from './appConfigFile';
import {DATA_FOLDER_NAME} from './locations';
import {electronLocationContext, registerStore} from './register';
import {writeJson} from './testFiles';

describe('registerStore', () => {
  it('warns once about a broken app.json, naming the file and the field', async () => {
    const context = await developmentContext();
    await writeJson(join(context.appDataFolder, 'app.json'), {
      format: 'llapp',
      schemaVersion: 1,
      layout: {normal: {left: 'wide'}},
    });
    const log = mockLog();
    await register(log, context);

    await askForService();

    expect(log.warn.mock.calls).toEqual([
      [
        'app.json is broken, so the app keeps it as it is and never writes over it',
        expect.objectContaining({
          file: join(context.appDataFolder, 'app.json'),
          field: 'layout.normal.left',
        }),
      ],
    ]);
  });

  it('lists and pushes the files skipped at startup, settings and content, once each', async () => {
    const context = await developmentContext();
    const root = join(context.appDataFolder, DATA_FOLDER_NAME);
    await writeJson(join(root, 'Songs', 'broken.llsong'), '{"format": ');
    await writeJson(join(root, 'Settings', 'looks.json'), '{broken looks');
    const sources: Array<() => readonly AppProblem[]> = [];
    const push = vi.fn<(problem: AppProblem) => void>();
    const store = registerStore({
      problems: {
        report: vi.fn(),
        push,
        addStanding: source => {
          sources.push(source);
          return () => undefined;
        },
      },
      log: mockLog(),
      isAnyOutputOn: () => false,
      appConfig: await openAppConfig({
        file: join(context.appDataFolder, 'app.json'),
        log: mockLog(),
      }),
      context: () => ({
        developmentFolder: context.developmentFolder,
        documents: context.documents,
      }),
    });
    disposers.push(store.dispose);
    await askForService();
    await ask(settingsEndpoints.get.channel, {name: 'looks'});
    const skipped = (): readonly AppProblem[] =>
      sources
        .flatMap(source => source())
        .filter(problem => problem.kind === 'file-skipped');
    const expected = [
      expect.objectContaining({kind: 'file-skipped', name: 'broken.llsong'}),
      expect.objectContaining({kind: 'file-skipped', name: 'looks.json'}),
    ];

    await vi.waitFor(() =>
      expect([...skipped()].sort(byName)).toEqual(expected),
    );
    expect(push.mock.calls.map(([problem]) => problem).sort(byName)).toEqual(
      [...skipped()].sort(byName),
    );
    expect(
      new Set(
        skipped().map(problem => ('fileId' in problem ? problem.fileId : 0)),
      ).size,
    ).toBe(2);
  });

  it('logs a data folder that a junction leads outside and answers null', async () => {
    const context = await developmentContext();
    const outside = await makeTempDir();
    const link = join(context.appDataFolder, DATA_FOLDER_NAME);
    await symlink(outside, link, 'junction');
    onTestFinished(() => rm(link, {force: true}));
    const log = mockLog();
    await register(log, context);

    expect(await askForService()).toBeNull();
    expect(log.error).toHaveBeenCalledWith(
      'refused the data folder',
      expect.objectContaining({field: 'dataRoot'}),
    );
    expect(log.info).not.toHaveBeenCalled();
  });

  it('backs up once the data is read, and dispose waits for the backup', async () => {
    const context = await developmentContext();
    const log = mockLog();
    const {dispose} = await register(log, context);

    await askForService();
    await dispose();

    const backups = await readdir(
      join(context.appDataFolder, 'LoveLightBackups'),
    );
    expect(backups).toHaveLength(1);
    expect(log.info.mock.calls.map(([message]) => message)).toContain(
      'backed up the data',
    );
  });

  it('finds media files by id once the data is read', async () => {
    const context = await developmentContext();
    const root = join(context.appDataFolder, DATA_FOLDER_NAME);
    const mediaId = '3b9d0c52-7e1f-4a2b-8c3d-4e5f60718293';
    await writeJson(join(root, 'Settings', 'media.json'), {
      format: 'llmedia',
      schemaVersion: 1,
      items: [
        {id: mediaId, name: '빛', kind: 'video', file: '빛.mp4', size: 1},
      ],
      playlists: [],
      audioPlaylists: [],
    });
    const store = await register(mockLog(), context, () => true);

    expect(await store.findMediaFile(mediaId)).toBe(
      join(root, 'Media', '빛.mp4'),
    );
    expect(await store.findMediaFile('unknown')).toBeNull();
    expect(store.mediaRoots()).toEqual([join(root, 'Media')]);
  });

  it('logs a failure to find the data and answers null', async () => {
    const log = mockLog();
    const appConfig = await openAppConfig({
      file: join(await makeTempDir(), 'app.json'),
      log,
    });
    const store = registerStore({
      problems: mockProblems(),
      log,
      isAnyOutputOn: () => false,
      appConfig,
      context: () => {
        throw new Error('no documents folder');
      },
    });
    disposers.push(store.dispose);

    expect(await askForService()).toBeNull();
    expect(log.error).toHaveBeenCalledWith(
      'could not read the data folder',
      expect.any(Error),
    );
    expect(await ask(settingsEndpoints.preferences.channel)).toMatchObject({
      show: {showClearUndoButton: false},
    });
  });
});

describe('electronLocationContext', () => {
  it('uses the folders Electron gives and LLP_USER_DATA', () => {
    electron.paths.set('userData', join('C:', 'data', 'app'));
    electron.paths.set('documents', join('C:', 'data', 'documents'));
    vi.stubEnv('LLP_USER_DATA', join('C:', 'data', 'app'));

    expect(electronLocationContext()).toEqual({
      documents: join('C:', 'data', 'documents'),
      developmentFolder: join('C:', 'data', 'app'),
    });
  });

  it('has no development folder when LLP_USER_DATA is unset or empty', () => {
    vi.stubEnv('LLP_USER_DATA', undefined);
    expect(electronLocationContext().developmentFolder).toBeNull();

    vi.stubEnv('LLP_USER_DATA', '');
    expect(electronLocationContext().developmentFolder).toBeNull();
  });
});
