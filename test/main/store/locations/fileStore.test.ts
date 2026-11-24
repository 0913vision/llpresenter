import {mkdir, readFile, readdir, rm, symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {makeTempDir} from '@fixtures/tempDir';
import {parseSong} from '@core/schema/songs/song';
import type {Logger} from '@main/base/log';
import {openAppConfig} from '@main/store/locations/appConfigFile';
import {loadStore, type LoadedStore} from '@main/store/locations/fileStore';
import {DATA_FOLDER_NAME} from '@main/store/locations/locations';
import {
  EVENING_ID,
  HYMN_ONE_ID,
  hymnOne,
  itemId,
  service,
  SUNDAY_ID,
  writeJson,
} from '@fixtures/main/store/testFiles';

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
  it('starts with the Sunday template and default 이름표, without songs or services', async () => {
    const context = await developmentContext();

    const store = await loadedStore(context);

    expect(store.locations.dataRoot).toBe(dataRoot(context));
    expect(store.songs.size).toBe(0);
    expect(store.services.size).toBe(0);
    expect([...store.templates.values()].map(({data}) => data)).toMatchObject([
      {name: '주일 2부 예배'},
    ]);
    expect(store.openServiceId).toBeNull();
    expect(store.problems).toEqual([]);
  });

  it('seeds a missing Templates folder without restoring a deleted template in an existing folder', async () => {
    const context = await developmentContext();
    await mkdir(join(dataRoot(context), 'Songs'), {recursive: true});
    const empty = await loadedStore(context);
    expect(empty.templates.size).toBe(1);
    expect(await readdir(join(dataRoot(context), 'Songs'))).toEqual([]);

    const freshContext = await developmentContext();
    const fresh = await loadedStore(freshContext);
    const builtIn = [...fresh.templates.values()][0];
    if (builtIn === undefined) throw Error('Missing built-in template');
    const original = await readFile(builtIn.file, 'utf8');
    await loadedStore(freshContext);
    expect(await readFile(builtIn.file, 'utf8')).toBe(original);
    await rm(builtIn.file);
    expect((await loadedStore(freshContext)).templates.size).toBe(0);
  });

  it('loads songs, services, and 이름표 from the data folder', async () => {
    const context = await developmentContext();
    const root = dataRoot(context);
    await writeJson(join(root, 'Songs', `${HYMN_ONE_ID}.llsong`), hymnOne());
    await writeJson(
      join(root, 'Services', `${SUNDAY_ID}.llservice`),
      service(SUNDAY_ID, '2026-11-01T11:00', [
        {
          id: itemId(1),
          kind: 'song',
          name: '곡',
          song: HYMN_ONE_ID,
          slides: [],
        },
      ]),
    );

    const store = await loadedStore(context);

    expect(store.songs.get(HYMN_ONE_ID)?.data.title).toBe('만복의 근원 하나님');
    expect(store.services.get(SUNDAY_ID)?.data.order).toHaveLength(1);
    expect(store.openServiceId).toBe(SUNDAY_ID);
    expect(store.problems).toEqual([]);
  });

  it('loads templates separately, preserving their path and unknown item fields', async () => {
    const context = await developmentContext();
    const file = join(
      dataRoot(context),
      'Templates',
      'original-name.llservice',
    );
    await writeJson(file, {
      format: 'llservice',
      schemaVersion: 1,
      id: SUNDAY_ID,
      name: '주일 템플릿',
      time: '11:00',
      order: [
        {id: itemId(1), kind: 'header', name: '찬양', future: {enabled: true}},
      ],
    });
    await writeJson(
      join(dataRoot(context), 'Templates', 'broken.llservice'),
      '{',
    );

    const store = await loadedStore(context);

    expect(store.templates.get(SUNDAY_ID)).toMatchObject({
      file,
      data: {time: '11:00', order: [{future: {enabled: true}}]},
    });
    expect(store.services.size).toBe(0);
    expect(store.problems).toMatchObject([
      {
        file: join(dataRoot(context), 'Templates', 'broken.llservice'),
        kind: 'json',
      },
    ]);
  });

  it('opens the last opened service, or else the newest one', async () => {
    const context = await developmentContext();
    const services = join(dataRoot(context), 'Services');
    await writeJson(
      join(services, 'a.llservice'),
      service(SUNDAY_ID, '2026-10-31T11:00', []),
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
    const grouped = parseSong(JSON.stringify(hymnOne()), 'future.llsong');
    if (!grouped.ok) throw new Error('Invalid grouped fixture');
    await writeJson(join(dataRoot(context), 'Songs', 'a.llsong'), {
      ...grouped.value.data,
      schemaVersion: 99,
    });

    const store = await loadedStore(context);

    expect(store.songs.get(HYMN_ONE_ID)?.access).toBe('readOnly');
    expect(store.problems).toEqual([]);
  });

  it('reads nothing when a junction leads the data folder outside', async () => {
    const context = await developmentContext();
    const outside = await makeTempDir();
    await writeJson(join(outside, 'Songs', 'a.llsong'), hymnOne());
    const link = dataRoot(context);
    await symlink(outside, link, 'junction');
    onTestFinished(() => rm(link, {force: true}));

    const loaded = await load(context);

    expect(loaded).toMatchObject({ok: false, error: {field: 'dataRoot'}});
  });

  it('skips a broken song and reports it', async () => {
    const context = await developmentContext();
    const songs = join(dataRoot(context), 'Songs');
    await writeJson(join(songs, 'good.llsong'), hymnOne());
    await writeJson(join(songs, 'bad.llsong'), {...hymnOne(), title: ''});

    const store = await loadedStore(context);

    expect([...store.songs.keys()]).toEqual([HYMN_ONE_ID]);
    expect(store.problems).toEqual([
      expect.objectContaining({
        kind: 'invalid',
        field: 'title',
      }),
    ]);
  });

  it('keeps the folders of a broken app.json and reports nothing more', async () => {
    const context = await developmentContext();
    const songs = join(context.appDataFolder, 'elsewhere', 'Songs');
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

  it('finds media files from media.json in the media folder', async () => {
    const context = await developmentContext();
    const root = dataRoot(context);
    await writeJson(join(root, 'Settings', 'media.json'), {
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
      join(root, 'Media', '따뜻한 빛.mp4'),
    );
    expect(store.media.roots).toEqual([join(root, 'Media')]);
    expect(store.problems).toEqual([]);
  });
});
