import {readdir, rm, symlink} from 'node:fs/promises';
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
import type {StoreContext} from './fileStore';
import {DATA_FOLDER_NAME} from './locations';
import {electronStoreContext, registerStore} from './register';
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

async function developmentContext(): Promise<StoreContext> {
  const folder = await makeTempDir();
  return {
    appDataFolder: folder,
    developmentFolder: folder,
    documents: join(folder, 'not-used-in-development'),
  };
}

const disposers: Array<() => Promise<void>> = [];

function register(
  log: Logger,
  context: () => StoreContext,
  isAnyOutputOn: () => boolean = () => false,
): () => Promise<void> {
  const dispose = registerStore({log, isAnyOutputOn, context});
  disposers.push(dispose);
  return dispose;
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
    const dispose = register(fakeLog(), () => context);

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
    register(log, () => context);

    expect(await askForService()).toBeNull();
    expect(log.info).toHaveBeenCalledWith(
      'read the data folder',
      expect.objectContaining({songs: 0, services: 0, openServiceId: null}),
    );
    expect(log.warn).not.toHaveBeenCalled();
  });

  it('warns once about a broken app.json and logs each problem', async () => {
    const context = await developmentContext();
    await writeJson(join(context.appDataFolder, 'app.json'), {
      format: 'llapp',
      schemaVersion: 1,
      layout: {normal: {left: 'wide'}},
    });
    const log = fakeLog();
    register(log, () => context);

    await askForService();

    expect(log.warn.mock.calls).toEqual([
      ['app.json is broken, so the app never writes over it'],
      [
        'skipped a data file or a part of one',
        expect.objectContaining({field: 'layout.normal.left'}),
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
    register(log, () => context);

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
    register(log, () => context);

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
    const dispose = register(log, () => context);

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

  it('skips the launch backup while an output is on', async () => {
    const context = await developmentContext();
    const log = fakeLog();
    const dispose = register(
      log,
      () => context,
      () => true,
    );

    await dispose();

    expect(log.info).toHaveBeenCalledWith('skipped the launch backup', {
      reason: 'output-on',
    });
  });

  it('logs a failure to find the data and answers null', async () => {
    const log = fakeLog();
    register(log, () => {
      throw new Error('no documents folder');
    });

    expect(await askForService()).toBeNull();
    expect(log.error).toHaveBeenCalledWith(
      'could not read the data folder',
      expect.any(Error),
    );
  });
});

describe('electronStoreContext', () => {
  it('uses the folders Electron gives and LLP_USER_DATA', () => {
    electron.paths.set('userData', join('D:', 'llp-dev', 'data'));
    electron.paths.set('documents', join('C:', 'Users', 'me', 'Documents'));
    vi.stubEnv('LLP_USER_DATA', join('D:', 'llp-dev', 'data'));

    expect(electronStoreContext()).toEqual({
      appDataFolder: join('D:', 'llp-dev', 'data'),
      documents: join('C:', 'Users', 'me', 'Documents'),
      developmentFolder: join('D:', 'llp-dev', 'data'),
    });
  });

  it('has no development folder when LLP_USER_DATA is unset or empty', () => {
    vi.stubEnv('LLP_USER_DATA', undefined);
    expect(electronStoreContext().developmentFolder).toBeNull();

    vi.stubEnv('LLP_USER_DATA', '');
    expect(electronStoreContext().developmentFolder).toBeNull();
  });
});
