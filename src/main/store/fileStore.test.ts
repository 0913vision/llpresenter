import {rm, symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {makeTempDir} from '../../../test/temp-dir';
import {defaultPreferences} from '@shared/schema/preferences';
import type {Logger} from '../log';
import {openAppConfig} from './appConfigFile';
import {DEFAULT_LABELS} from './defaults';
import {loadStore, type LoadedStore} from './fileStore';
import {DATA_FOLDER_NAME} from './locations';
import {
  EVENING_ID,
  HYMN_ONE_ID,
  hymnOne,
  itemId,
  service,
  SUNDAY_ID,
  writeJson,
} from './testFiles';

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

function quietLog(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    flush: () => Promise.resolve(),
  };
}

async function load({appDataFolder, ...context}: TestFolders) {
  const appConfig = await openAppConfig({
    file: join(appDataFolder, 'app.json'),
    log: quietLog(),
  });
  return loadStore({...context, appConfig});
}

async function loadedStore(context: TestFolders): Promise<LoadedStore> {
  const loaded = await load(context);
  if (!loaded.ok) {
    throw new Error(loaded.error.message);
  }
  return loaded.value;
}

function dataRoot(context: TestFolders): string {
  return join(context.appDataFolder, DATA_FOLDER_NAME);
}

describe('loadStore', () => {
  it('starts empty, with the default 이름표, on the first launch', async () => {
    const context = await developmentContext();

    const store = await loadedStore(context);

    expect(store.locations.dataRoot).toBe(dataRoot(context));
    expect(store.songs.size).toBe(0);
    expect(store.services.size).toBe(0);
    expect(store.labels).toEqual(DEFAULT_LABELS);
    expect(store.preferences).toEqual(defaultPreferences);
    expect(store.openServiceId).toBeNull();
    expect(store.problems).toEqual([]);
  });

  it('loads songs, services, and 이름표 from the data folder', async () => {
    const context = await developmentContext();
    const root = dataRoot(context);
    await writeJson(join(root, '곡', `${HYMN_ONE_ID}.llsong`), hymnOne());
    await writeJson(
      join(root, '예배', `${SUNDAY_ID}.llservice`),
      service(SUNDAY_ID, '2026-11-01T11:00', [
        {id: itemId(1), song: HYMN_ONE_ID},
      ]),
    );
    await writeJson(join(root, '설정', 'labels.json'), {
      format: 'llsettings.labels',
      schemaVersion: 1,
      labels: [{name: '후렴', color: 'yellow', key: 'KeyC'}],
    });

    const store = await loadedStore(context);

    expect(store.songs.get(HYMN_ONE_ID)?.data.title).toBe('만복의 근원 하나님');
    expect(store.services.get(SUNDAY_ID)?.data.order).toHaveLength(1);
    expect(store.labels).toEqual([
      {name: '후렴', color: 'yellow', key: 'KeyC'},
    ]);
    expect(store.openServiceId).toBe(SUNDAY_ID);
    expect(store.problems).toEqual([]);
  });

  it('opens the last opened service, or else the newest one', async () => {
    const context = await developmentContext();
    const services = join(dataRoot(context), '예배');
    await writeJson(
      join(services, 'a.llservice'),
      service(SUNDAY_ID, '2026-11-01T11:00', []),
    );
    await writeJson(
      join(services, 'b.llservice'),
      service(EVENING_ID, '2026-11-01T19:30', []),
    );

    expect((await loadedStore(context)).openServiceId).toBe(EVENING_ID);

    await writeJson(join(context.appDataFolder, 'app.json'), {
      format: 'llapp',
      schemaVersion: 1,
      lastServiceId: SUNDAY_ID,
    });
    expect((await loadedStore(context)).openServiceId).toBe(SUNDAY_ID);
  });

  it('loads a song from a newer app version read-only', async () => {
    const context = await developmentContext();
    await writeJson(join(dataRoot(context), '곡', 'a.llsong'), {
      ...hymnOne(),
      schemaVersion: 99,
    });

    const store = await loadedStore(context);

    expect(store.songs.get(HYMN_ONE_ID)?.access).toBe('readOnly');
    expect(store.problems).toEqual([]);
  });

  it('reads nothing when a junction leads the data folder outside', async () => {
    const context = await developmentContext();
    const outside = await makeTempDir();
    await writeJson(join(outside, '곡', 'a.llsong'), hymnOne());
    const link = dataRoot(context);
    await symlink(outside, link, 'junction');
    onTestFinished(() => rm(link, {force: true}));

    const loaded = await load(context);

    expect(loaded).toMatchObject({ok: false, error: {field: 'dataRoot'}});
  });

  it('skips a broken song and reports it', async () => {
    const context = await developmentContext();
    const songs = join(dataRoot(context), '곡');
    await writeJson(join(songs, 'good.llsong'), hymnOne());
    await writeJson(join(songs, 'bad.llsong'), {...hymnOne(), title: ''});

    const store = await loadedStore(context);

    expect([...store.songs.keys()]).toEqual([HYMN_ONE_ID]);
    expect(store.problems).toEqual([
      expect.objectContaining({kind: 'invalid', field: 'title'}),
    ]);
  });

  it('keeps the folders of a broken app.json and reports nothing more', async () => {
    const context = await developmentContext();
    const songs = join(context.appDataFolder, 'elsewhere', '곡');
    await writeJson(join(context.appDataFolder, 'app.json'), {
      format: 'llapp',
      schemaVersion: 1,
      songsPath: songs,
      layout: {normal: {left: 'wide'}},
    });

    const store = await loadedStore(context);

    expect(store.locations.songs).toBe(songs);
    expect(store.problems).toEqual([]);
  });

  it('ignores an app.json folder outside LLP_USER_DATA and reports it', async () => {
    const context = await developmentContext();
    const outside = join(context.documents, '..', '..', 'real', 'LoveLight');
    await writeJson(join(context.appDataFolder, 'app.json'), {
      format: 'llapp',
      schemaVersion: 1,
      dataRoot: outside,
    });

    const store = await loadedStore(context);

    expect(store.locations.dataRoot).toBe(dataRoot(context));
    expect(store.problems).toEqual([
      expect.objectContaining({kind: 'invalid', field: 'dataRoot'}),
    ]);
  });

  it('uses the default 이름표 when labels.json is broken, and reports it', async () => {
    const context = await developmentContext();
    await writeJson(
      join(dataRoot(context), '설정', 'labels.json'),
      '{"labels": ',
    );

    const store = await loadedStore(context);

    expect(store.labels).toEqual(DEFAULT_LABELS);
    expect(store.problems).toEqual([expect.objectContaining({kind: 'json'})]);
  });

  it('runs a broken labels.json from its newest recovery copy', async () => {
    const context = await developmentContext();
    const root = dataRoot(context);
    await writeJson(join(root, '설정', 'labels.json'), '{"labels": ');
    await writeJson(
      join(root, '.복구 사본', 'settings', 'labels', '2026-10-25.json'),
      {
        format: 'llsettings.labels',
        schemaVersion: 1,
        labels: [{name: '후렴', color: 'yellow', key: 'KeyC'}],
      },
    );

    const store = await loadedStore(context);

    expect(store.labels).toEqual([
      {name: '후렴', color: 'yellow', key: 'KeyC'},
    ]);
    expect(store.problems).toEqual([expect.objectContaining({kind: 'json'})]);
  });

  it('reads 환경설정 with the defaults for the fields it leaves out', async () => {
    const context = await developmentContext();
    await writeJson(join(dataRoot(context), '설정', 'preferences.json'), {
      format: 'llsettings.preferences',
      schemaVersion: 1,
      backup: {keep: 5},
    });

    const store = await loadedStore(context);

    expect(store.preferences.backup).toEqual({auto: true, keep: 5});
    expect(store.preferences.previewFps).toBe(defaultPreferences.previewFps);
    expect(store.problems).toEqual([]);
  });

  it('finds media files from media.json in the media folder', async () => {
    const context = await developmentContext();
    const root = dataRoot(context);
    await writeJson(join(root, '설정', 'media.json'), {
      format: 'llmedia',
      schemaVersion: 1,
      items: [
        {
          id: '3b9d0c52-7e1f-4a2b-8c3d-4e5f60718293',
          name: '따뜻한 빛',
          kind: 'video',
          file: '따뜻한 빛.mp4',
          size: 1024,
        },
      ],
      playlists: [],
      audioPlaylists: [],
    });

    const store = await loadedStore(context);

    expect(store.media.fileOf('3b9d0c52-7e1f-4a2b-8c3d-4e5f60718293')).toBe(
      join(root, '미디어', '따뜻한 빛.mp4'),
    );
    expect(store.media.roots).toEqual([join(root, '미디어')]);
    expect(store.problems).toEqual([]);
  });

  it('reports a jump key that labels.json drops', async () => {
    const context = await developmentContext();
    await writeJson(join(dataRoot(context), '설정', 'labels.json'), {
      format: 'llsettings.labels',
      schemaVersion: 1,
      labels: [{name: '후렴', color: 'yellow', key: 'C'}],
    });

    const store = await loadedStore(context);

    expect(store.labels).toEqual([{name: '후렴', color: 'yellow', key: null}]);
    expect(store.problems).toEqual([
      expect.objectContaining({kind: 'invalid', field: 'labels.0.key'}),
    ]);
  });
});
