import {fixtureSlideId} from '@fixtures/core/songs/slideFixtures';
import {
  ask,
  developmentContext,
  electron,
  mockLog,
  register,
} from '@fixtures/main/store/registerFixtures';
import {contentEndpoints} from '@contracts/ipc/content';
import {libraryEndpoints} from '@contracts/ipc/library';
import {settingsEndpoints} from '@contracts/ipc/settings';
import {parseEditResult} from '@core/schema/contentEdit';
import {
  parseSettingsDocument,
  settingsNames,
  type SettingsDocument,
} from '@core/schema/settingsDocuments';
import {readdir, readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {DATA_FOLDER_NAME} from '@main/store/locations';
import {
  HYMN_ONE_ID,
  hymnOne,
  itemId,
  writeJson,
} from '@fixtures/main/store/testFiles';

describe('registerStore', () => {
  it('renames a label through settings IPC, pushes the changed songs, and retains the files across restart', async () => {
    const context = await developmentContext();
    const root = join(context.appDataFolder, DATA_FOLDER_NAME);
    const labelFile = join(root, 'Settings', 'labels.json');
    await writeJson(labelFile, {
      format: 'llsettings.labels',
      schemaVersion: 1,
      labels: [{name: 'Before', color: '#5FB8C2', key: null, future: 'kept'}],
      future: 'kept',
    });
    const ids = [itemId(1), itemId(2)];
    for (const [index, id] of ids.entries()) {
      await writeJson(join(root, 'Songs', `${id}.llsong`), {
        format: 'llsong',
        schemaVersion: 1,
        id,
        title: `Invented song ${index}`,
        slides: [
          {
            id: fixtureSlideId(1),
            lines: ['Invented line'],
            future: 'kept',
            label: 'Before',
          },
        ],
      });
    }
    const first = await register(mockLog(), context, () => true);
    await ask(settingsEndpoints.get.channel, {name: 'labels'});
    const rename = {
      type: 'labels.rename',
      name: 'labels',
      from: 'Before',
      to: 'After',
      baseRevision: 1,
    };
    expect(
      await ask(settingsEndpoints.edit.channel, {...rename, to: ' '}),
    ).toMatchObject({ok: false, error: {reason: 'invalid'}});
    electron.send.mockClear();
    expect(await ask(settingsEndpoints.edit.channel, rename)).toEqual({
      ok: true,
      value: {id: 'labels', revision: 2},
    });
    expect(electron.send).toHaveBeenCalledWith(
      settingsEndpoints.changed.channel,
      expect.objectContaining({name: 'labels', revision: 2}),
    );
    for (const id of ids) {
      expect(electron.send).toHaveBeenCalledWith(
        contentEndpoints.songs.changed.channel,
        {
          songId: id,
          document: await ask(contentEndpoints.songs.get.channel, id),
        },
      );
    }
    expect(await ask(settingsEndpoints.edit.channel, rename)).toMatchObject({
      ok: false,
      error: {reason: 'stale'},
    });
    expect(JSON.parse(await readFile(labelFile, 'utf8'))).toMatchObject({
      future: 'kept',
      labels: [{name: 'After', future: 'kept'}],
    });
    await first.dispose();
    await register(mockLog(), context, () => true);
    expect(
      await ask(settingsEndpoints.get.channel, {name: 'labels'}),
    ).toMatchObject({
      revision: 1,
      value: {labels: [{name: 'After'}]},
    });
    for (const id of ids) {
      expect(await ask(contentEndpoints.songs.get.channel, id)).toMatchObject({
        revision: 1,
        song: {slides: [{future: 'kept', label: 'After'}]},
      });
      expect(
        JSON.parse(await readFile(join(root, 'Songs', `${id}.llsong`), 'utf8')),
      ).toMatchObject({slides: [{label: 'After'}]});
    }
  });

  it('pushes a settings edit before the disk answer and retains current extensions across restart', async () => {
    const context = await developmentContext();
    const file = join(
      context.appDataFolder,
      DATA_FOLDER_NAME,
      'Settings',
      'messages.json',
    );
    const template = {
      id: HYMN_ONE_ID,
      name: 'Before',
      icon: 'msg',
      text: 'Old invented message',
    };
    const base = {
      format: 'llsettings.messages',
      schemaVersion: 1,
    };
    await writeJson(file, {
      ...base,
      templates: [
        {...template, targets: 'all', duration: null, future: 'kept'},
      ],
      future: {enabled: true},
    });
    const first = await register(mockLog(), context, () => true);
    const mainChanges: SettingsDocument[] = [];
    const removeMainChanges = first.subscribeSettingsChanges(document =>
      mainChanges.push(document),
    );
    await ask(settingsEndpoints.get.channel, {name: 'messages'});
    expect(await first.readSettings('messages')).toEqual(
      await ask(settingsEndpoints.get.channel, {name: 'messages'}),
    );
    electron.send.mockClear();
    const updated = {...template, name: 'After', text: 'New invented message'};
    const expected = {
      ...base,
      templates: [{...updated, future: 'kept'}],
      future: {enabled: true},
    };
    const pending = ask(settingsEndpoints.edit.channel, {
      type: 'settings.update',
      name: 'messages',
      value: {...base, templates: [updated]},
      baseRevision: 1,
    });
    await Promise.resolve();
    expect(electron.send).toHaveBeenCalledWith(
      settingsEndpoints.changed.channel,
      {
        name: 'messages',
        value: expected,
        revision: 2,
        access: 'editable',
      },
    );
    expect(await pending).toEqual({
      ok: true,
      value: {id: 'messages', revision: 2},
    });
    expect(mainChanges).toEqual([await first.readSettings('messages')]);
    removeMainChanges();
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual(expected);
    await first.dispose();
    await register(mockLog(), context, () => true);
    expect(
      await ask(settingsEndpoints.get.channel, {name: 'messages'}),
    ).toEqual({
      name: 'messages',
      value: expected,
      revision: 1,
      access: 'editable',
    });
  });

  it('creates every missing settings file with valid defaults and serves revisioned reads', async () => {
    const context = await developmentContext();
    await register(mockLog(), context, () => true);
    for (const name of settingsNames) {
      const reply = parseSettingsDocument(
        await ask(settingsEndpoints.get.channel, {name}),
      );
      expect(reply.ok).toBe(true);
      const file = join(
        context.appDataFolder,
        DATA_FOLDER_NAME,
        'Settings',
        `${name}.json`,
      );
      const value: unknown = JSON.parse(await readFile(file, 'utf8'));
      if (!reply.ok) throw new Error(reply.error.message);
      expect(reply.value).toMatchObject({
        name,
        value,
        revision: 1,
        access: 'editable',
      });
      if (reply.value.name === 'screens') {
        expect(reply.value.value.screens.map(screen => screen.name)).toEqual([
          '청중 화면',
          '방송 화면',
          '무대 화면',
        ]);
      }
    }
    expect(await ask(settingsEndpoints.preferences.channel)).toMatchObject({
      show: {atLastSlide: 'stop'},
    });
  });

  it('retains existing content, unknown fields and newer read-only access across restart', async () => {
    const context = await developmentContext();
    const file = join(
      context.appDataFolder,
      DATA_FOLDER_NAME,
      'Settings',
      'messages.json',
    );
    const value = {
      format: 'llsettings.messages',
      schemaVersion: 2,
      templates: [],
      future: {enabled: true},
    };
    await writeJson(file, value);
    const first = await register(mockLog(), context, () => true);
    expect(
      await ask(settingsEndpoints.get.channel, {name: 'messages'}),
    ).toMatchObject({
      value,
      access: 'readOnly',
    });
    await first.dispose();
    await register(mockLog(), context, () => true);
    expect(
      await ask(settingsEndpoints.get.channel, {name: 'messages'}),
    ).toMatchObject({
      value,
      access: 'readOnly',
    });
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual(value);
  });

  it('imports through IPC, keeps the overwritten recovery copy, and keeps free labels out of the catalog', async () => {
    const context = await developmentContext();
    const root = join(context.appDataFolder, DATA_FOLDER_NAME);
    const file = join(root, 'Songs', 'song.llsong');
    const original = {...hymnOne(), future: 'kept'};
    await writeJson(file, original);
    await register(mockLog(), context);
    const result = parseEditResult(
      await ask(contentEndpoints.edit.channel, {
        type: 'song.import',
        draft: {
          title: 'Invented import',
          slides: [
            {
              id: fixtureSlideId(3),
              lines: ['Invented line'],
              label: 'Invented label',
            },
          ],
        },
        target: {kind: 'overwrite', songId: HYMN_ONE_ID, baseRevision: 1},
      }),
    );
    expect(result).toMatchObject({
      ok: true,
      value: {ok: true, value: {id: HYMN_ONE_ID, revision: 2}},
    });
    expect(JSON.parse(await readFile(file, 'utf8'))).toMatchObject({
      title: 'Invented import',
      future: 'kept',
    });
    const copies = join(root, '.recovery', 'song', HYMN_ONE_ID);
    const [copy] = await readdir(copies);
    if (copy === undefined) throw new Error('Missing recovery copy');
    expect(JSON.parse(await readFile(join(copies, copy), 'utf8'))).toEqual(
      original,
    );
    expect(
      JSON.parse(await readFile(join(root, 'Settings', 'labels.json'), 'utf8')),
    ).not.toHaveProperty(
      'labels',
      expect.arrayContaining([
        {name: 'Invented label', color: 'none', key: null},
      ]),
    );
    expect(
      (await readdir(join(root, 'Songs'))).filter(name =>
        name.endsWith('.tmp'),
      ),
    ).toHaveLength(0);
    expect(
      await ask(libraryEndpoints.search.channel, {query: 'Invented import'}),
    ).toMatchObject({matches: [{title: 'Invented import'}]});
  });

  it('waits for the existing load and answers both preference reads alike', async () => {
    const context = await developmentContext();
    await writeJson(
      join(
        context.appDataFolder,
        DATA_FOLDER_NAME,
        'Settings',
        'preferences.json',
      ),
      {
        format: 'llsettings.preferences',
        schemaVersion: 1,
        show: {atLastSlide: 'nextItem'},
      },
    );
    const log = mockLog();
    await register(log, context, () => true);
    const [first, second] = await Promise.all([
      ask(settingsEndpoints.preferences.channel),
      ask(settingsEndpoints.preferences.channel),
    ]);
    expect(first).toMatchObject({show: {atLastSlide: 'nextItem'}});
    expect(second).toEqual(first);
    expect(
      log.info.mock.calls.filter(
        ([message]) => message === 'read the data folder',
      ),
    ).toHaveLength(1);
  });

  it('removes the preferences handler on disposal', async () => {
    const context = await developmentContext();
    const store = await register(mockLog(), context, () => true);
    await store.dispose();
    expect(electron.handlers.has(settingsEndpoints.preferences.channel)).toBe(
      false,
    );
  });
});
