import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {makeTempDir} from '../../../test/temp-dir';
import {DEFAULT_LABELS} from './defaults';
import {loadStore, type StoreContext} from './fileStore';
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

async function developmentContext(): Promise<StoreContext> {
  const folder = await makeTempDir();
  return {
    appDataFolder: folder,
    developmentFolder: folder,
    documents: join(folder, 'not-used-in-development'),
  };
}

function dataRoot(context: StoreContext): string {
  return join(context.appDataFolder, DATA_FOLDER_NAME);
}

describe('loadStore', () => {
  it('starts empty, with the default 이름표, on the first launch', async () => {
    const context = await developmentContext();

    const store = await loadStore(context);

    expect(store.locations.dataRoot).toBe(dataRoot(context));
    expect(store.songs.size).toBe(0);
    expect(store.services.size).toBe(0);
    expect(store.labels).toEqual(DEFAULT_LABELS);
    expect(store.openServiceId).toBeNull();
    expect(store.appConfigBroken).toBe(false);
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

    const store = await loadStore(context);

    expect(store.songs.get(HYMN_ONE_ID)?.title).toBe('만복의 근원 하나님');
    expect(store.services.get(SUNDAY_ID)?.order).toHaveLength(1);
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

    expect((await loadStore(context)).openServiceId).toBe(EVENING_ID);

    await writeJson(join(context.appDataFolder, 'app.json'), {
      format: 'llapp',
      schemaVersion: 1,
      lastServiceId: SUNDAY_ID,
    });
    expect((await loadStore(context)).openServiceId).toBe(SUNDAY_ID);
  });

  it('skips a broken song and reports it', async () => {
    const context = await developmentContext();
    const songs = join(dataRoot(context), '곡');
    await writeJson(join(songs, 'good.llsong'), hymnOne());
    await writeJson(join(songs, 'bad.llsong'), {...hymnOne(), title: ''});

    const store = await loadStore(context);

    expect([...store.songs.keys()]).toEqual([HYMN_ONE_ID]);
    expect(store.problems).toEqual([
      expect.objectContaining({kind: 'invalid', field: 'title'}),
    ]);
  });

  it('keeps the folders of a broken app.json and marks it broken', async () => {
    const context = await developmentContext();
    const songs = join(context.appDataFolder, 'elsewhere', '곡');
    await writeJson(join(context.appDataFolder, 'app.json'), {
      format: 'llapp',
      schemaVersion: 1,
      songsPath: songs,
      layout: {normal: {left: 'wide'}},
    });

    const store = await loadStore(context);

    expect(store.locations.songs).toBe(songs);
    expect(store.appConfigBroken).toBe(true);
    expect(store.problems).toEqual([
      expect.objectContaining({kind: 'invalid', field: 'layout.normal.left'}),
    ]);
  });

  it('ignores an app.json folder outside LLP_USER_DATA and reports it', async () => {
    const context = await developmentContext();
    const outside = join(context.documents, '..', '..', 'real', 'LoveLight');
    await writeJson(join(context.appDataFolder, 'app.json'), {
      format: 'llapp',
      schemaVersion: 1,
      dataRoot: outside,
    });

    const store = await loadStore(context);

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

    const store = await loadStore(context);

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

    const store = await loadStore(context);

    expect(store.labels).toEqual([
      {name: '후렴', color: 'yellow', key: 'KeyC'},
    ]);
    expect(store.problems).toEqual([expect.objectContaining({kind: 'json'})]);
  });

  it('reports a jump key that labels.json drops', async () => {
    const context = await developmentContext();
    await writeJson(join(dataRoot(context), '설정', 'labels.json'), {
      format: 'llsettings.labels',
      schemaVersion: 1,
      labels: [{name: '후렴', color: 'yellow', key: 'C'}],
    });

    const store = await loadStore(context);

    expect(store.labels).toEqual([{name: '후렴', color: 'yellow', key: null}]);
    expect(store.problems).toEqual([
      expect.objectContaining({kind: 'invalid', field: 'labels.0.key'}),
    ]);
  });
});
