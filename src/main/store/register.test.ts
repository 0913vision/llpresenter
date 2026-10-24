import {readdir, rm, symlink, utimes} from 'node:fs/promises';
import {join} from 'node:path';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi,
} from 'vitest';
import {Channels} from '@shared/ipc';
import {makeTempDir} from '../../../test/temp-dir';
import type {Logger} from '../log';
import {openAppConfig} from './appConfigFile';
import {DATA_FOLDER_NAME} from './locations';
import {
  electronLocationContext,
  registerStore,
  type DataStore,
} from './register';
import {
  HYMN_ONE_ID,
  hymnOne,
  itemId,
  service,
  SUNDAY_ID,
  writeJson,
} from './testFiles';

type Handler = () => unknown;

const electron = vi.hoisted(() => ({
  handlers: new Map<string, () => unknown>(),
  paths: new Map<string, string>(),
}));

vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => electron.paths.get(name) ?? '',
  },
  ipcMain: {
    handle: (channel: string, handler: Handler) => {
      electron.handlers.set(channel, handler);
    },
    removeHandler: (channel: string) => {
      electron.handlers.delete(channel);
    },
  },
}));

function fakeLog() {
  return {
    info: vi.fn<Logger['info']>(),
    warn: vi.fn<Logger['warn']>(),
    error: vi.fn<Logger['error']>(),
    flush: () => Promise.resolve(),
  } satisfies Logger;
}

interface TestFolders {
  readonly appDataFolder: string;
  readonly developmentFolder: string;
  readonly documents: string;
}

async function developmentContext(): Promise<TestFolders> {
  const folder = await makeTempDir();
  return {
    appDataFolder: folder,
    developmentFolder: folder,
    documents: join(folder, 'not-used-in-development'),
  };
}

const disposers: Array<() => Promise<void>> = [];

async function register(
  log: Logger,
  {appDataFolder, developmentFolder, documents}: TestFolders,
  isAnyOutputOn: () => boolean = () => false,
): Promise<DataStore> {
  const appConfig = await openAppConfig({
    file: join(appDataFolder, 'app.json'),
    log,
  });
  const store = registerStore({
    log,
    isAnyOutputOn,
    appConfig,
    context: () => ({developmentFolder, documents}),
  });
  disposers.push(store.dispose);
  return store;
}

function askForService(): Promise<unknown> {
  return Promise.resolve(electron.handlers.get(Channels.serviceGet)?.());
}

beforeEach(() => {
  electron.handlers.clear();
  electron.paths.clear();
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(disposers.splice(0).map(async dispose => dispose()));
});

describe('registerStore', () => {
  it('answers service:get with the open 예배 순서 at its first revision', async () => {
    const context = await developmentContext();
    const root = join(context.appDataFolder, DATA_FOLDER_NAME);
    await writeJson(join(root, '곡', 'a.llsong'), hymnOne());
    await writeJson(
      join(root, '예배', 'a.llservice'),
      service(SUNDAY_ID, '2026-11-01T11:00', [
        {id: itemId(1), song: HYMN_ONE_ID},
      ]),
    );
    const {dispose} = await register(fakeLog(), context);

    expect(await askForService()).toMatchObject({
      revision: 1,
      id: SUNDAY_ID,
      rows: [{kind: 'song', id: itemId(1), title: '만복의 근원 하나님'}],
    });
    await dispose();
    expect(electron.handlers.has(Channels.serviceGet)).toBe(false);
  });

  it('answers null when there is no 예배 순서', async () => {
    const context = await developmentContext();
    const log = fakeLog();
    await register(log, context);

    expect(await askForService()).toBeNull();
    expect(log.info).toHaveBeenCalledWith(
      'read the data folder',
      expect.objectContaining({songs: 0, services: 0, openServiceId: null}),
    );
    expect(log.warn).not.toHaveBeenCalled();
  });

  it('warns once about a broken app.json, naming the file and the field', async () => {
    const context = await developmentContext();
    await writeJson(join(context.appDataFolder, 'app.json'), {
      format: 'llapp',
      schemaVersion: 1,
      layout: {normal: {left: 'wide'}},
    });
    const log = fakeLog();
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

  it('logs at most 50 problems and counts the rest', async () => {
    const context = await developmentContext();
    const songs = join(context.appDataFolder, DATA_FOLDER_NAME, '곡');
    await Promise.all(
      Array.from({length: 52}, (_value, index) =>
        writeJson(join(songs, `${index}.llsong`), '{"format": '),
      ),
    );
    const log = fakeLog();
    await register(log, context);

    await askForService();

    expect(log.warn).toHaveBeenCalledTimes(51);
    expect(log.warn).toHaveBeenLastCalledWith(
      'skipped 2 more data files or parts of them',
    );
  });

  it('logs a data folder that a junction leads outside and answers null', async () => {
    const context = await developmentContext();
    const outside = await makeTempDir();
    const link = join(context.appDataFolder, DATA_FOLDER_NAME);
    await symlink(outside, link, 'junction');
    onTestFinished(() => rm(link, {force: true}));
    const log = fakeLog();
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
    const log = fakeLog();
    const {dispose} = await register(log, context);

    await askForService();
    await dispose();

    const backups = await readdir(
      join(context.appDataFolder, 'LoveLight 백업'),
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
    await writeJson(join(root, '설정', 'media.json'), {
      format: 'llmedia',
      schemaVersion: 1,
      items: [
        {id: mediaId, name: '빛', kind: 'video', file: '빛.mp4', size: 1},
      ],
      playlists: [],
      audioPlaylists: [],
    });
    const store = await register(fakeLog(), context, () => true);

    expect(await store.findMediaFile(mediaId)).toBe(
      join(root, '미디어', '빛.mp4'),
    );
    expect(await store.findMediaFile('unknown')).toBeNull();
    expect(store.mediaRoots()).toEqual([join(root, '미디어')]);
  });

  it('removes temporary files that a cut-off write left, before the backup', async () => {
    const context = await developmentContext();
    const songs = join(context.appDataFolder, DATA_FOLDER_NAME, '곡');
    const leftover = join(
      songs,
      '.a.llsong.3b9d0c52-7e1f-4a2b-8c3d-4e5f60718293.tmp',
    );
    await writeJson(leftover, 'half written');
    const twoMinutesAgo = (Date.now() - 120_000) / 1000;
    await utimes(leftover, twoMinutesAgo, twoMinutesAgo);
    const {dispose} = await register(fakeLog(), context);

    await dispose();

    expect(await readdir(songs)).toEqual([]);
    const [backup = ''] = await readdir(
      join(context.appDataFolder, 'LoveLight 백업'),
    );
    expect(
      await readdir(
        join(context.appDataFolder, 'LoveLight 백업', backup, '곡'),
      ),
    ).toEqual([]);
  });

  it('skips the launch backup while an output is on', async () => {
    const context = await developmentContext();
    const log = fakeLog();
    const {dispose} = await register(log, context, () => true);

    await dispose();

    expect(log.info).toHaveBeenCalledWith('skipped the launch backup', {
      reason: 'output-on',
    });
  });

  it('logs a failure to find the data and answers null', async () => {
    const log = fakeLog();
    const appConfig = await openAppConfig({
      file: join(await makeTempDir(), 'app.json'),
      log,
    });
    const store = registerStore({
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
  });
});

describe('electronLocationContext', () => {
  it('uses the folders Electron gives and LLP_USER_DATA', () => {
    electron.paths.set('userData', join('D:', 'llp-dev', 'data'));
    electron.paths.set('documents', join('C:', 'Users', 'me', 'Documents'));
    vi.stubEnv('LLP_USER_DATA', join('D:', 'llp-dev', 'data'));

    expect(electronLocationContext()).toEqual({
      documents: join('C:', 'Users', 'me', 'Documents'),
      developmentFolder: join('D:', 'llp-dev', 'data'),
    });
  });

  it('has no development folder when LLP_USER_DATA is unset or empty', () => {
    vi.stubEnv('LLP_USER_DATA', undefined);
    expect(electronLocationContext().developmentFolder).toBeNull();

    vi.stubEnv('LLP_USER_DATA', '');
    expect(electronLocationContext().developmentFolder).toBeNull();
  });
});
