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
import {parsePreferencesValue} from '@core/schema/preferences';
import {
  parseSettingsDocument,
  settingsNames,
  type SettingsDocument,
} from '@core/schema/settingsDocuments';
import {readdir, readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it, vi} from 'vitest';
import {DATA_FOLDER_NAME} from '@main/store/locations';
import type {SettingsProblemListener} from '@main/store/settingsStore';
import {HYMN_ONE_ID, hymnOne, itemId, writeJson} from '@main/store/testFiles';

describe('registerStore', () => {
  it('renames a label through settings IPC, pushes the changed songs, and retains the files across restart', async () => {
    const context = await developmentContext();
    const root = join(context.appDataFolder, DATA_FOLDER_NAME);
    const labelFile = join(root, 'Settings', 'labels.json');
    await writeJson(labelFile, {
      format: 'llsettings.labels',
      schemaVersion: 1,
      labels: [{name: 'Before', color: 'teal', key: null, future: 'kept'}],
      future: 'kept',
    });
    const ids = [itemId(1), itemId(2)];
    for (const [index, id] of ids.entries()) {
      await writeJson(join(root, 'Songs', `${id}.llsong`), {
        format: 'llsong',
        schemaVersion: 1,
        id,
        title: `Invented song ${index}`,
        slides: [{label: 'Before', lines: ['Invented line'], future: 'kept'}],
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
        song: {groups: [{name: 'After', slides: [{future: 'kept'}]}]},
      });
      expect(
        JSON.parse(await readFile(join(root, 'Songs', `${id}.llsong`), 'utf8')),
      ).toMatchObject({groups: [{name: 'After'}]});
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
      stagePresets: [],
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

  it('reads and pushes normalized preferences from the edited canonical document', async () => {
    const context = await developmentContext();
    const file = join(
      context.appDataFolder,
      DATA_FOLDER_NAME,
      'Settings',
      'preferences.json',
    );
    const value = {format: 'llsettings.preferences', schemaVersion: 1};
    await writeJson(file, {
      ...value,
      show: {showClearUndoButton: false, future: 'kept'},
    });
    await register(mockLog(), context, () => true);
    await ask(settingsEndpoints.get.channel, {name: 'preferences'});
    const pending = ask(settingsEndpoints.edit.channel, {
      type: 'settings.update',
      name: 'preferences',
      value: {...value, show: {showClearUndoButton: true}},
      baseRevision: 1,
    });
    await Promise.resolve();
    const normalized = await ask(settingsEndpoints.preferences.channel);
    expect(parsePreferencesValue(normalized).ok).toBe(true);
    expect(normalized).toMatchObject({
      show: {showClearUndoButton: true, future: 'kept'},
      backupCopies: 10,
    });
    expect(electron.send).toHaveBeenCalledWith(
      settingsEndpoints.preferencesChanged.channel,
      normalized,
    );
    expect(await pending).toEqual({
      ok: true,
      value: {id: 'preferences', revision: 2},
    });
  });

  it('refuses invalid edits and newer settings without mutating or broadcasting them', async () => {
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
      stagePresets: [],
      future: true,
    };
    await writeJson(file, value);
    const store = await register(mockLog(), context, () => true);
    await ask(settingsEndpoints.get.channel, {name: 'messages'});
    electron.send.mockClear();
    expect(
      await ask(settingsEndpoints.edit.channel, {
        type: 'settings.update',
        name: '../app',
        value,
        baseRevision: 1,
      }),
    ).toMatchObject({ok: false, error: {reason: 'invalid'}});
    expect(
      await ask(settingsEndpoints.edit.channel, {
        type: 'settings.update',
        name: 'messages',
        value,
        baseRevision: 1,
      }),
    ).toMatchObject({ok: false, error: {reason: 'read-only'}});
    expect(electron.send).not.toHaveBeenCalled();
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual(value);
    await store.dispose();
    expect(electron.handlers.has(settingsEndpoints.edit.channel)).toBe(false);
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
          '본 화면',
          '방송 자막',
          '무대 화면',
        ]);
      }
      if (reply.value.name === 'messages') {
        expect(reply.value.value.stagePresets).toHaveLength(7);
      }
    }
    expect(await ask(settingsEndpoints.preferences.channel)).toMatchObject({
      show: {showClearUndoButton: false},
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
      stagePresets: ['사용자 문구'],
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

  it('emits and warns once per broken file, keeps it untouched, and still loads the others', async () => {
    const context = await developmentContext();
    const folder = join(context.appDataFolder, DATA_FOLDER_NAME, 'Settings');
    await writeJson(join(folder, 'labels.json'), {format: 'wrong'});
    await writeJson(join(folder, 'themes.json'), {format: 'wrong'});
    await writeJson(join(folder, 'preferences.json'), {
      format: 'llsettings.preferences',
      schemaVersion: 1,
      backupCopies: 99999,
      previewFps: 1,
    });
    const log = mockLog();
    const store = await register(log, context, () => true);
    const cancelled = vi.fn();
    store.subscribeSettingsProblems(cancelled)();
    const listener = vi.fn<SettingsProblemListener>();
    const unsubscribe = store.subscribeSettingsProblems(listener);
    await ask(settingsEndpoints.get.channel, {name: 'bible'});
    expect(cancelled).not.toHaveBeenCalled();
    expect(listener.mock.calls.map(([problem]) => problem.file)).toEqual([
      'themes.json',
      'labels.json',
      'preferences.json',
    ]);
    expect(listener.mock.calls[0]?.[0].error).toMatchObject({
      kind: 'format',
      file: join(folder, 'themes.json'),
    });
    expect(
      log.warn.mock.calls.filter(
        ([message]) => message === 'skipped a data file or a part of one',
      ),
    ).toHaveLength(3);
    expect(
      JSON.parse(await readFile(join(folder, 'themes.json'), 'utf8')),
    ).toEqual({format: 'wrong'});
    unsubscribe();
    await store.dispose();
    expect(electron.handlers.has(settingsEndpoints.get.channel)).toBe(false);
    const late = vi.fn();
    store.subscribeSettingsProblems(late);
    await Promise.resolve();
    expect(late).not.toHaveBeenCalled();
  });

  it('neither reads nor changes the old Look and stage layout files', async () => {
    const context = await developmentContext();
    const folder = join(context.appDataFolder, DATA_FOLDER_NAME, 'Settings');
    const legacy = {format: 'wrong', future: [1, 2]};
    await writeJson(join(folder, 'looks.json'), legacy);
    await writeJson(join(folder, 'stage-layouts.json'), legacy);
    const store = await register(mockLog(), context, () => true);
    const listener = vi.fn<SettingsProblemListener>();
    const unsubscribe = store.subscribeSettingsProblems(listener);
    await ask(settingsEndpoints.get.channel, {name: 'themes'});
    expect(listener).not.toHaveBeenCalled();
    for (const file of ['looks.json', 'stage-layouts.json']) {
      expect(JSON.parse(await readFile(join(folder, file), 'utf8'))).toEqual(
        legacy,
      );
    }
    unsubscribe();
  });

  it('refuses malformed settings reads', async () => {
    await register(mockLog(), await developmentContext(), () => true);
    await expect(
      ask(settingsEndpoints.get.channel, {name: '../app'}),
    ).rejects.toThrow('Invalid settings read');
  });

  it('imports through IPC, keeps the overwritten recovery copy, and persists new labels', async () => {
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
          slides: [{label: 'Invented label', lines: ['Invented line']}],
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
    ).toHaveProperty(
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

  it.each([
    undefined,
    {},
    {showClearUndoButton: false},
    {showClearUndoButton: true},
  ])(
    'waits for the existing load and returns the normalized show preference %j',
    async show => {
      const context = await developmentContext();
      if (show !== undefined) {
        await writeJson(
          join(
            context.appDataFolder,
            DATA_FOLDER_NAME,
            'Settings',
            'preferences.json',
          ),
          {format: 'llsettings.preferences', schemaVersion: 1, show},
        );
      }
      const log = mockLog();
      await register(log, context, () => true);
      const [first, second] = await Promise.all([
        ask(settingsEndpoints.preferences.channel),
        ask(settingsEndpoints.preferences.channel),
      ]);
      expect(first).toMatchObject({
        show: {showClearUndoButton: show?.showClearUndoButton ?? false},
      });
      expect(second).toEqual(first);
      expect(parsePreferencesValue(first).ok).toBe(true);
      expect(
        log.info.mock.calls.filter(
          ([message]) => message === 'read the data folder',
        ),
      ).toHaveLength(1);
    },
  );

  it('defaults a broken preference without rewriting the original file', async () => {
    const context = await developmentContext();
    const file = join(
      context.appDataFolder,
      DATA_FOLDER_NAME,
      'Settings',
      'preferences.json',
    );
    await writeJson(file, {
      format: 'llsettings.preferences',
      schemaVersion: 1,
      show: {showClearUndoButton: 'yes'},
    });
    const original = await readFile(file, 'utf8');
    const log = mockLog();
    await register(log, context, () => true);
    expect(await ask(settingsEndpoints.preferences.channel)).toMatchObject({
      show: {showClearUndoButton: false},
    });
    expect(log.warn).toHaveBeenCalled();
    expect(await readFile(file, 'utf8')).toBe(original);
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
