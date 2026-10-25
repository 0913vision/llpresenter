import {readdir, readFile, rm, symlink, utimes} from 'node:fs/promises';
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
import {parseEditResult} from '@shared/schema/contentEdit';
import {parseSong} from '@shared/schema/song';
import {parseShowService} from '@shared/schema/showService';
import {parseServiceDocument} from '@shared/schema/contentDocuments';
import {createMediaId} from '@shared/schema/ids';
import {parseMediaDocument} from '@shared/schema/mediaEdit';
import {parsePreferencesValue} from '@shared/schema/preferences';
import {
  parseSettingsDocument,
  settingsNames,
  type SettingsDocument,
} from '@shared/schema/settingsDocuments';
import {parseLibrarySearchResult} from '@shared/schema/librarySearch';
import {makeTempDir} from '../../../test/temp-dir';
import type {Logger} from '../log';
import * as atomicWrite from './atomicWrite';
import {openAppConfig} from './appConfigFile';
import {DATA_FOLDER_NAME} from './locations';
import type {SettingsProblemListener} from './settingsStore';
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

type Handler = (event: unknown, value: unknown) => unknown;

const electron = vi.hoisted(() => ({
  handlers: new Map<string, Handler>(),
  paths: new Map<string, string>(),
  send: vi.fn(),
}));

vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: () => [
      {
        isDestroyed: () => false,
        webContents: {isDestroyed: () => false, send: electron.send},
      },
    ],
  },
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
  return ask(Channels.serviceGet);
}

function ask(channel: string, value?: unknown): Promise<unknown> {
  const handler = electron.handlers.get(channel);
  if (handler === undefined) throw new Error(`Missing handler: ${channel}`);
  return Promise.resolve(handler({}, value));
}

beforeEach(() => {
  electron.handlers.clear();
  electron.paths.clear();
  electron.send.mockReset();
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(disposers.splice(0).map(async dispose => dispose()));
});

describe('registerStore', () => {
  it('reads the latest standalone song revision and returns null after deletion', async () => {
    const context = await developmentContext();
    const root = join(context.appDataFolder, DATA_FOLDER_NAME);
    const song = {
      format: 'llsong',
      schemaVersion: 1,
      id: itemId(82),
      title: 'Standalone editable song',
      slides: [{lines: ['Before']}],
    };
    await writeJson(join(root, '곡', `${song.id}.llsong`), song);
    const store = await register(fakeLog(), context, () => true);
    expect(
      await ask(Channels.libraryShowSong, {songId: song.id}),
    ).toMatchObject({songRevision: 1});
    expect(
      await ask(Channels.contentEdit, {
        type: 'song.update',
        baseRevision: 1,
        song: {...song, title: 'After edit', slides: [{lines: ['After']}]},
      }),
    ).toMatchObject({ok: true});
    expect(
      await ask(Channels.libraryShowSong, {songId: song.id}),
    ).toMatchObject({
      songRevision: 2,
      title: 'After edit',
      tiles: [{lines: ['After']}],
    });
    expect(
      await ask(Channels.contentEdit, {type: 'song.delete', songId: song.id}),
    ).toMatchObject({ok: true});
    expect(await ask(Channels.libraryShowSong, {songId: song.id})).toBeNull();
    await store.dispose();
  });
  it('projects a standalone song, rechecks its background file, and leaves the service unchanged', async () => {
    const context = await developmentContext();
    const root = join(context.appDataFolder, DATA_FOLDER_NAME);
    const mediaId = createMediaId(itemId(80));
    const songId = itemId(81);
    const songFile = join(root, '곡', `${songId}.llsong`);
    const mediaFile = join(root, '미디어', 'standalone.webm');
    await writeJson(mediaFile, 'Invented media bytes');
    await writeJson(join(root, '설정', 'media.json'), {
      format: 'llmedia',
      schemaVersion: 1,
      items: [
        {
          id: mediaId,
          name: 'Standalone background',
          kind: 'video',
          file: 'standalone.webm',
          size: 20,
          props: {end: 'stop'},
        },
      ],
      playlists: [],
      audioPlaylists: [],
    });
    await writeJson(songFile, {
      format: 'llsong',
      schemaVersion: 2,
      id: songId,
      title: 'Standalone invented song',
      background: mediaId,
      slides: [{label: 'Verse', lines: ['First']}, {lines: ['Second']}],
      arrangements: [{name: 'Other', slides: [2, 1, 2]}],
      future: 'kept',
    });
    const store = await register(fakeLog(), context, () => true);
    const before = await askForService();
    const content = await store.content;
    const serviceId = content?.openServiceId;
    const shown = await ask(Channels.libraryShowSong, {songId});
    expect(shown).toMatchObject({
      songId,
      songRevision: 1,
      readOnly: true,
      problem: 'newer-version',
      tiles: [{lines: ['First']}, {lines: ['Second']}],
      background: {mediaId, loop: false},
    });
    expect(
      await ask(Channels.libraryShowSong, {songId: itemId(99)}),
    ).toBeNull();
    await rm(mediaFile);
    const missing = await ask(Channels.libraryShowSong, {songId});
    expect(missing).toMatchObject({
      readOnly: true,
      problem: 'missing-background',
    });
    expect(missing).not.toHaveProperty('background');
    expect(await askForService()).toEqual(before);
    expect(content?.openServiceId).toBe(serviceId);
    expect(
      electron.send.mock.calls.some(
        ([channel]) => channel === Channels.liveChanged,
      ),
    ).toBe(false);
    expect(JSON.parse(await readFile(songFile, 'utf8'))).toHaveProperty(
      'future',
      'kept',
    );
    await store.dispose();
    expect(electron.handlers.has(Channels.libraryShowSong)).toBe(false);
  });
  it('refreshes the open service from edited media and leaves deleted media bytes intact', async () => {
    const context = await developmentContext();
    const root = join(context.appDataFolder, DATA_FOLDER_NAME);
    const mediaId = createMediaId(itemId(1));
    const songId = itemId(2);
    const mediaFile = join(root, '미디어', 'invented.webm');
    await writeJson(mediaFile, 'Invented file bytes');
    await writeJson(join(root, '설정', 'media.json'), {
      format: 'llmedia',
      schemaVersion: 1,
      items: [
        {
          id: mediaId,
          name: 'Invented media',
          kind: 'video',
          file: 'invented.webm',
          size: 19,
        },
      ],
      playlists: [],
      audioPlaylists: [],
    });
    await writeJson(join(root, '곡', `${songId}.llsong`), {
      format: 'llsong',
      schemaVersion: 1,
      id: songId,
      title: 'Invented song',
      background: mediaId,
      slides: [{lines: ['Invented line']}],
    });
    await writeJson(join(root, '예배', `${itemId(3)}.llservice`), {
      format: 'llservice',
      schemaVersion: 1,
      id: itemId(3),
      name: 'Invented service',
      date: '2026-10-26T10:00',
      order: [{id: itemId(4), song: songId}],
    });
    const registered = await register(fakeLog(), context, () => true);
    const content = await registered.content;
    expect(content?.openServiceId).toBe(itemId(3));
    expect(content?.service(itemId(3))?.service.order).toEqual([
      {id: itemId(4), song: songId},
    ]);
    expect(await askForService()).toMatchObject({
      rows: [{background: {mediaId, loop: true}}],
    });
    expect(
      await ask(Channels.mediaEdit, {
        type: 'media.properties.update',
        mediaId,
        baseRevision: 1,
        changes: {props: {end: 'stop'}},
      }),
    ).toMatchObject({ok: true});
    expect(await askForService()).toMatchObject({
      rows: [{background: {mediaId, loop: false}}],
    });
    expect(
      await ask(Channels.mediaEdit, {type: 'media.delete', mediaId}),
    ).toMatchObject({ok: true});
    expect(await askForService()).toMatchObject({
      rows: [{problem: 'missing-background'}],
    });
    expect(await readFile(mediaFile, 'utf8')).toBe('Invented file bytes');
  });
  it('saves media edits across restart and updates current lookup and roots after relink completion and delete', async () => {
    const context = await developmentContext();
    const root = join(context.appDataFolder, DATA_FOLDER_NAME);
    const id = createMediaId(itemId(1));
    const file = join(root, '설정', 'media.json');
    const value = {
      format: 'llmedia',
      schemaVersion: 1,
      future: 'kept',
      items: [
        {
          id,
          name: 'Before',
          kind: 'video',
          file: 'old.webm',
          size: 10,
          props: {end: 'loop', future: 'kept'},
        },
      ],
      playlists: [],
      audioPlaylists: [],
    };
    await writeJson(file, value);
    const first = await register(fakeLog(), context, () => true);
    const initial = parseMediaDocument(await ask(Channels.mediaGet));
    if (!initial.ok) throw new Error(initial.error.message);
    expect(await first.findMediaFile(id)).toBe(
      join(root, '미디어', 'old.webm'),
    );
    electron.send.mockClear();
    expect(
      await ask(Channels.mediaEdit, {
        type: 'media.properties.update',
        mediaId: id,
        baseRevision: 1,
        changes: {name: 'After'},
      }),
    ).toMatchObject({ok: true, value: {revision: 2}});
    expect(electron.send).toHaveBeenCalledWith(
      Channels.mediaChanged,
      await ask(Channels.mediaGet),
    );
    const media = await first.media;
    if (media === null) throw new Error('Missing media store');
    const item = media.get().value.items[0];
    if (item === undefined) throw new Error('Missing fixture media');
    expect(
      (
        await media.replace({
          baseRevision: 2,
          items: [{...item, file: 'new.webm'}],
        })
      ).ok,
    ).toBe(true);
    expect(await first.findMediaFile(id)).toBe(
      join(root, '미디어', 'new.webm'),
    );
    expect(first.mediaRoots()).toEqual([join(root, '미디어')]);
    expect(JSON.parse(await readFile(file, 'utf8'))).toHaveProperty(
      'future',
      'kept',
    );
    expect(JSON.parse(await readFile(file, 'utf8'))).toHaveProperty(
      'items.0.props.future',
      'kept',
    );
    await first.dispose();
    const second = await register(fakeLog(), context, () => true);
    expect(await ask(Channels.mediaGet)).toMatchObject({
      revision: 1,
      value: {items: [{name: 'After', file: 'new.webm'}]},
    });
    expect(
      await ask(Channels.mediaEdit, {type: 'media.delete', mediaId: id}),
    ).toMatchObject({ok: true});
    expect(await second.findMediaFile(id)).toBeNull();
  });

  it('creates missing media data and replays one media problem while other settings stay readable', async () => {
    const context = await developmentContext();
    const root = join(context.appDataFolder, DATA_FOLDER_NAME);
    const file = join(root, '설정', 'media.json');
    const first = await register(fakeLog(), context, () => true);
    expect(await ask(Channels.mediaGet)).toMatchObject({
      value: {items: [], playlists: [], audioPlaylists: []},
    });
    expect(JSON.parse(await readFile(file, 'utf8'))).toMatchObject({
      format: 'llmedia',
    });
    await first.dispose();
    await writeJson(file, '{broken media');
    const second = await register(fakeLog(), context, () => true);
    const problems: string[] = [];
    const stop = second.subscribeSettingsProblems(problem =>
      problems.push(problem.file),
    );
    await ask(Channels.mediaGet);
    expect(await ask(Channels.settingsGet, {name: 'notices'})).toMatchObject({
      name: 'notices',
    });
    expect(problems).toEqual(['media.json']);
    expect(await readFile(file, 'utf8')).toBe('{broken media');
    stop();
  });
  it('saves and switches services, remembers the choice across restart, and sends no live-output change', async () => {
    const context = await developmentContext();
    const root = join(context.appDataFolder, DATA_FOLDER_NAME);
    const ids = [itemId(1), itemId(2)];
    const firstId = itemId(1);
    const secondId = itemId(2);
    const appFile = join(context.appDataFolder, 'app.json');
    await writeJson(appFile, {
      format: 'llapp',
      schemaVersion: 1,
      lastServiceId: firstId,
      uiZoomPercent: 120,
      future: 'kept',
    });
    for (const [index, id] of ids.entries()) {
      await writeJson(join(root, '예배', `${id}.llservice`), {
        format: 'llservice',
        schemaVersion: 1,
        id,
        name: `Invented service ${index}`,
        date: '2026-10-26T10:00',
        order: [],
      });
    }
    const first = await register(fakeLog(), context, () => true);
    expect(await askForService()).toMatchObject({id: firstId});
    expect(await ask(Channels.serviceOpen, {serviceId: itemId(9)})).toBeNull();
    expect(await askForService()).toMatchObject({id: firstId});
    const current = await ask(Channels.servicesDocumentGet, firstId);
    const parsed = parseServiceDocument(current);
    if (!parsed.ok || parsed.value === null) {
      throw new Error('Missing fixture service');
    }
    await ask(Channels.contentEdit, {
      type: 'service.update',
      service: {...parsed.value.service, name: 'Edited current service'},
      baseRevision: 1,
    });
    electron.send.mockClear();
    expect(
      await ask(Channels.serviceOpen, {serviceId: secondId}),
    ).toMatchObject({id: secondId});
    expect(await askForService()).toMatchObject({id: secondId});
    expect(
      JSON.parse(
        await readFile(join(root, '예배', `${firstId}.llservice`), 'utf8'),
      ),
    ).toMatchObject({name: 'Edited current service'});
    expect(JSON.parse(await readFile(appFile, 'utf8'))).toMatchObject({
      lastServiceId: secondId,
      uiZoomPercent: 120,
      future: 'kept',
    });
    expect(electron.send).toHaveBeenCalledWith(
      Channels.serviceChanged,
      expect.objectContaining({id: secondId}),
    );
    expect(electron.send).not.toHaveBeenCalledWith(
      Channels.liveChanged,
      expect.anything(),
    );
    await first.dispose();
    await register(fakeLog(), context, () => true);
    expect(await askForService()).toMatchObject({id: secondId});
  });

  it('keeps the current service and saved launch choice when saving its pending edit fails', async () => {
    const context = await developmentContext();
    const root = join(context.appDataFolder, DATA_FOLDER_NAME);
    const firstId = itemId(1);
    const secondId = itemId(2);
    const appFile = join(context.appDataFolder, 'app.json');
    const firstFile = join(root, '예배', `${firstId}.llservice`);
    await writeJson(appFile, {
      format: 'llapp',
      schemaVersion: 1,
      lastServiceId: firstId,
    });
    for (const [index, id] of [firstId, secondId].entries()) {
      await writeJson(join(root, '예배', `${id}.llservice`), {
        format: 'llservice',
        schemaVersion: 1,
        id,
        name: `Invented service ${index}`,
        date: '2026-10-26T10:00',
        order: [],
      });
    }
    const original = atomicWrite.writeFileAtomically;
    const write = vi
      .spyOn(atomicWrite, 'writeFileAtomically')
      .mockImplementation((file, text) =>
        file === firstFile
          ? Promise.resolve({
              ok: false,
              error: {file, message: 'Disk unavailable'},
            })
          : original(file, text),
      );
    await register(fakeLog(), context, () => true);
    await askForService();
    const parsed = parseServiceDocument(
      await ask(Channels.servicesDocumentGet, firstId),
    );
    if (!parsed.ok || parsed.value === null) {
      throw new Error('Missing fixture service');
    }
    await ask(Channels.contentEdit, {
      type: 'service.update',
      service: {...parsed.value.service, name: 'Unsaved current service'},
      baseRevision: 1,
    });
    expect(await ask(Channels.serviceOpen, {serviceId: secondId})).toBeNull();
    expect(
      write.mock.calls.filter(([file]) => file === firstFile),
    ).toHaveLength(1);
    expect(await askForService()).toMatchObject({
      id: firstId,
      name: 'Unsaved current service',
    });
    expect(JSON.parse(await readFile(firstFile, 'utf8'))).toMatchObject({
      name: 'Invented service 0',
    });
    expect(JSON.parse(await readFile(appFile, 'utf8'))).toMatchObject({
      lastServiceId: firstId,
    });
  });
  it('renames a label through settings IPC, pushes the changed songs, and retains the files across restart', async () => {
    const context = await developmentContext();
    const root = join(context.appDataFolder, DATA_FOLDER_NAME);
    const labelFile = join(root, '설정', 'labels.json');
    await writeJson(labelFile, {
      format: 'llsettings.labels',
      schemaVersion: 1,
      labels: [{name: 'Before', color: 'teal', key: null, future: 'kept'}],
      future: 'kept',
    });
    const ids = [itemId(1), itemId(2)];
    for (const [index, id] of ids.entries()) {
      await writeJson(join(root, '곡', `${id}.llsong`), {
        format: 'llsong',
        schemaVersion: 1,
        id,
        title: `Invented song ${index}`,
        slides: [{label: 'Before', lines: ['Invented line'], future: 'kept'}],
      });
    }
    const first = await register(fakeLog(), context, () => true);
    await ask(Channels.settingsGet, {name: 'labels'});
    const rename = {
      type: 'labels.rename',
      name: 'labels',
      from: 'Before',
      to: 'After',
      baseRevision: 1,
    };
    expect(
      await ask(Channels.settingsEdit, {...rename, to: ' '}),
    ).toMatchObject({ok: false, error: {reason: 'invalid'}});
    electron.send.mockClear();
    expect(await ask(Channels.settingsEdit, rename)).toEqual({
      ok: true,
      value: {id: 'labels', revision: 2},
    });
    expect(electron.send).toHaveBeenCalledWith(
      Channels.settingsChanged,
      expect.objectContaining({name: 'labels', revision: 2}),
    );
    for (const id of ids) {
      expect(electron.send).toHaveBeenCalledWith(
        Channels.songsDocumentChanged,
        {songId: id, document: await ask(Channels.songsDocumentGet, id)},
      );
    }
    expect(await ask(Channels.settingsEdit, rename)).toMatchObject({
      ok: false,
      error: {reason: 'stale'},
    });
    expect(JSON.parse(await readFile(labelFile, 'utf8'))).toMatchObject({
      future: 'kept',
      labels: [{name: 'After', future: 'kept'}],
    });
    await first.dispose();
    await register(fakeLog(), context, () => true);
    expect(await ask(Channels.settingsGet, {name: 'labels'})).toMatchObject({
      revision: 1,
      value: {labels: [{name: 'After'}]},
    });
    for (const id of ids) {
      expect(await ask(Channels.songsDocumentGet, id)).toMatchObject({
        revision: 1,
        song: {slides: [{label: 'After', future: 'kept'}]},
      });
      expect(
        JSON.parse(await readFile(join(root, '곡', `${id}.llsong`), 'utf8')),
      ).toMatchObject({slides: [{label: 'After'}]});
    }
  });
  it('pushes a settings edit before the disk answer and retains current extensions across restart', async () => {
    const context = await developmentContext();
    const file = join(
      context.appDataFolder,
      DATA_FOLDER_NAME,
      '설정',
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
    const first = await register(fakeLog(), context, () => true);
    const mainChanges: SettingsDocument[] = [];
    const removeMainChanges = first.subscribeSettingsChanges(document =>
      mainChanges.push(document),
    );
    await ask(Channels.settingsGet, {name: 'messages'});
    expect(await first.readSettings('messages')).toEqual(
      await ask(Channels.settingsGet, {name: 'messages'}),
    );
    electron.send.mockClear();
    const updated = {...template, name: 'After', text: 'New invented message'};
    const expected = {
      ...base,
      templates: [{...updated, future: 'kept'}],
      future: {enabled: true},
    };
    const pending = ask(Channels.settingsEdit, {
      type: 'settings.update',
      name: 'messages',
      value: {...base, templates: [updated]},
      baseRevision: 1,
    });
    await Promise.resolve();
    expect(electron.send).toHaveBeenCalledWith(Channels.settingsChanged, {
      name: 'messages',
      value: expected,
      revision: 2,
      access: 'editable',
    });
    expect(await pending).toEqual({
      ok: true,
      value: {id: 'messages', revision: 2},
    });
    expect(mainChanges).toEqual([await first.readSettings('messages')]);
    removeMainChanges();
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual(expected);
    await first.dispose();
    await register(fakeLog(), context, () => true);
    expect(await ask(Channels.settingsGet, {name: 'messages'})).toEqual({
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
      '설정',
      'preferences.json',
    );
    const value = {format: 'llsettings.preferences', schemaVersion: 1};
    await writeJson(file, {
      ...value,
      show: {showClearUndoButton: false, future: 'kept'},
    });
    await register(fakeLog(), context, () => true);
    await ask(Channels.settingsGet, {name: 'preferences'});
    const pending = ask(Channels.settingsEdit, {
      type: 'settings.update',
      name: 'preferences',
      value: {...value, show: {showClearUndoButton: true}},
      baseRevision: 1,
    });
    await Promise.resolve();
    const normalized = await ask(Channels.preferencesGet);
    expect(parsePreferencesValue(normalized).ok).toBe(true);
    expect(normalized).toMatchObject({
      show: {showClearUndoButton: true, future: 'kept'},
      backupCopies: 10,
    });
    expect(electron.send).toHaveBeenCalledWith(
      Channels.preferencesChanged,
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
      '설정',
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
    const store = await register(fakeLog(), context, () => true);
    await ask(Channels.settingsGet, {name: 'messages'});
    electron.send.mockClear();
    expect(
      await ask(Channels.settingsEdit, {
        type: 'settings.update',
        name: '../app',
        value,
        baseRevision: 1,
      }),
    ).toMatchObject({ok: false, error: {reason: 'invalid'}});
    expect(
      await ask(Channels.settingsEdit, {
        type: 'settings.update',
        name: 'messages',
        value,
        baseRevision: 1,
      }),
    ).toMatchObject({ok: false, error: {reason: 'read-only'}});
    expect(electron.send).not.toHaveBeenCalled();
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual(value);
    await store.dispose();
    expect(electron.handlers.has(Channels.settingsEdit)).toBe(false);
  });

  it('creates every missing settings file with valid defaults and serves revisioned reads', async () => {
    const context = await developmentContext();
    await register(fakeLog(), context, () => true);
    for (const name of settingsNames) {
      const reply = parseSettingsDocument(
        await ask(Channels.settingsGet, {name}),
      );
      expect(reply.ok).toBe(true);
      const file = join(
        context.appDataFolder,
        DATA_FOLDER_NAME,
        '설정',
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
      if (reply.value.name === 'looks') {
        expect(reply.value.value.looks[0]?.name).toBe('평상시');
      }
      if (reply.value.name === 'stage-layouts') {
        expect(reply.value.value.layouts[0]?.elements).toHaveLength(7);
      }
      if (reply.value.name === 'messages') {
        expect(reply.value.value.stagePresets).toHaveLength(7);
      }
    }
    expect(await ask(Channels.preferencesGet)).toMatchObject({
      show: {showClearUndoButton: false},
    });
  });

  it('retains existing content, unknown fields and newer read-only access across restart', async () => {
    const context = await developmentContext();
    const file = join(
      context.appDataFolder,
      DATA_FOLDER_NAME,
      '설정',
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
    const first = await register(fakeLog(), context, () => true);
    expect(await ask(Channels.settingsGet, {name: 'messages'})).toMatchObject({
      value,
      access: 'readOnly',
    });
    await first.dispose();
    await register(fakeLog(), context, () => true);
    expect(await ask(Channels.settingsGet, {name: 'messages'})).toMatchObject({
      value,
      access: 'readOnly',
    });
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual(value);
  });

  it('emits and warns once per broken file, keeps it untouched, and still loads the others', async () => {
    const context = await developmentContext();
    const folder = join(context.appDataFolder, DATA_FOLDER_NAME, '설정');
    await writeJson(join(folder, 'labels.json'), {format: 'wrong'});
    await writeJson(join(folder, 'looks.json'), {format: 'wrong'});
    await writeJson(join(folder, 'preferences.json'), {
      format: 'llsettings.preferences',
      schemaVersion: 1,
      backupCopies: 99999,
      previewFps: 1,
    });
    const log = fakeLog();
    const store = await register(log, context, () => true);
    const cancelled = vi.fn();
    store.subscribeSettingsProblems(cancelled)();
    const listener = vi.fn<SettingsProblemListener>();
    const unsubscribe = store.subscribeSettingsProblems(listener);
    await ask(Channels.settingsGet, {name: 'bible'});
    expect(cancelled).not.toHaveBeenCalled();
    expect(listener.mock.calls.map(([problem]) => problem.file)).toEqual([
      'looks.json',
      'labels.json',
      'preferences.json',
    ]);
    expect(listener.mock.calls[0]?.[0].error).toMatchObject({
      kind: 'format',
      file: join(folder, 'looks.json'),
    });
    expect(
      log.warn.mock.calls.filter(
        ([message]) => message === 'skipped a data file or a part of one',
      ),
    ).toHaveLength(3);
    expect(
      JSON.parse(await readFile(join(folder, 'looks.json'), 'utf8')),
    ).toEqual({format: 'wrong'});
    unsubscribe();
    await store.dispose();
    expect(electron.handlers.has(Channels.settingsGet)).toBe(false);
    const late = vi.fn();
    store.subscribeSettingsProblems(late);
    await Promise.resolve();
    expect(late).not.toHaveBeenCalled();
  });

  it('refuses malformed settings reads', async () => {
    await register(fakeLog(), await developmentContext(), () => true);
    await expect(ask(Channels.settingsGet, {name: '../app'})).rejects.toThrow(
      'Invalid settings read',
    );
  });
  it('searches the initial library and applies song edits, deletion, and creation before the next search', async () => {
    const context = await developmentContext();
    const root = join(context.appDataFolder, DATA_FOLDER_NAME);
    const original = {
      ...hymnOne(),
      title: '새벽의 길',
      slides: [{lines: ['돌아온 아침빛']}],
      arrangements: [],
    };
    await writeJson(join(root, '곡', 'song.llsong'), original);
    const store = await register(fakeLog(), context, () => true);
    const initial = await ask(Channels.librarySearch, {query: '아침빛'});
    expect(parseLibrarySearchResult(initial)).toMatchObject({
      ok: true,
      value: {
        query: '아침빛',
        matches: [
          {
            songId: HYMN_ONE_ID,
            title: '새벽의 길',
            match: {kind: 'lyrics', line: '돌아온 아침빛'},
          },
        ],
      },
    });
    const edited = {
      ...original,
      title: '바람의 노래',
      slides: [{lines: ['다시 피어난 햇살']}],
    };
    expect(
      await ask(Channels.contentEdit, {
        type: 'song.update',
        song: edited,
        baseRevision: 1,
      }),
    ).toMatchObject({ok: true});
    expect(await ask(Channels.librarySearch, {query: '햇살'})).toMatchObject({
      matches: [{title: '바람의 노래'}],
    });
    expect(await ask(Channels.librarySearch, {query: '아침빛'})).toMatchObject({
      matches: [],
    });
    expect(
      await ask(Channels.librarySearch, {query: '새벽의 길'}),
    ).toMatchObject({matches: []});
    expect(
      await ask(Channels.contentEdit, {
        type: 'song.delete',
        songId: HYMN_ONE_ID,
      }),
    ).toMatchObject({ok: true});
    expect(await ask(Channels.librarySearch, {query: ''})).toMatchObject({
      matches: [],
    });
    expect(
      await ask(Channels.contentEdit, {type: 'song.create'}),
    ).toMatchObject({ok: true});
    expect(await ask(Channels.librarySearch, {query: '새곡'})).toMatchObject({
      matches: [{title: '새 곡'}],
    });
    await store.dispose();
    expect(electron.handlers.has(Channels.librarySearch)).toBe(false);
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
            '설정',
            'preferences.json',
          ),
          {format: 'llsettings.preferences', schemaVersion: 1, show},
        );
      }
      const log = fakeLog();
      await register(log, context, () => true);
      const [first, second] = await Promise.all([
        ask(Channels.preferencesGet),
        ask(Channels.preferencesGet),
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
      '설정',
      'preferences.json',
    );
    await writeJson(file, {
      format: 'llsettings.preferences',
      schemaVersion: 1,
      show: {showClearUndoButton: 'yes'},
    });
    const original = await readFile(file, 'utf8');
    const log = fakeLog();
    await register(log, context, () => true);
    expect(await ask(Channels.preferencesGet)).toMatchObject({
      show: {showClearUndoButton: false},
    });
    expect(log.warn).toHaveBeenCalled();
    expect(await readFile(file, 'utf8')).toBe(original);
  });

  it('removes the preferences handler on disposal', async () => {
    const context = await developmentContext();
    const store = await register(fakeLog(), context, () => true);
    await store.dispose();
    expect(electron.handlers.has(Channels.preferencesGet)).toBe(false);
  });

  it('refreshes background choices, missing-file warnings, and revisions on service reads', async () => {
    const context = await developmentContext();
    const root = join(context.appDataFolder, DATA_FOLDER_NAME);
    const mediaId = itemId(90);
    const video = join(root, '미디어', 'background.webm');
    await writeJson(video, 'video');
    await writeJson(join(root, '설정', 'media.json'), {
      format: 'llmedia',
      schemaVersion: 1,
      items: [
        {
          id: mediaId,
          name: 'Background',
          kind: 'video',
          file: 'background.webm',
          size: 5,
        },
      ],
      playlists: [],
      audioPlaylists: [],
    });
    await writeJson(join(root, '곡', 'song.llsong'), {
      ...hymnOne(),
      background: mediaId,
    });
    await writeJson(
      join(root, '예배', 'open.llservice'),
      service(SUNDAY_ID, '2026-11-01T11:00', [
        {id: itemId(1), song: HYMN_ONE_ID},
      ]),
    );
    await register(fakeLog(), context, () => true);

    expect(await askForService()).toMatchObject({
      revision: 1,
      rows: [{background: {mediaId, loop: true}}],
    });
    await rm(video);
    const missing = await askForService();
    expect(missing).toMatchObject({
      revision: 2,
      rows: [{problem: 'missing-background'}],
    });
    expect(parseShowService(missing)).toMatchObject({ok: true});
    await writeJson(video, 'returned');
    expect(await askForService()).toMatchObject({
      revision: 3,
      rows: [{background: {mediaId, loop: true}}],
    });
    expect(
      electron.send.mock.calls.filter(
        ([channel]) => channel === Channels.serviceChanged,
      ),
    ).toHaveLength(2);
  });

  it('pushes edited song tiles without a live-state push and flushes before disposal', async () => {
    const context = await developmentContext();
    const root = join(context.appDataFolder, DATA_FOLDER_NAME);
    const file = join(root, '곡', 'original-name.llsong');
    await writeJson(file, {...hymnOne(), future: {enabled: true}});
    await writeJson(
      join(root, '예배', 'open.llservice'),
      service(SUNDAY_ID, '2026-11-01T11:00', [
        {id: itemId(1), song: HYMN_ONE_ID},
      ]),
    );
    const store = await register(fakeLog(), context, () => true);
    const before = parseShowService(await askForService());
    if (!before.ok || before.value === null) {
      throw new Error('Missing test service');
    }
    const edited = {
      ...hymnOne(),
      slides: [{lines: ['새로 편집한 가사']}],
      arrangements: [],
    };

    const answer = parseEditResult(
      await ask(Channels.contentEdit, {
        type: 'song.update',
        song: edited,
        baseRevision: 1,
      }),
    );
    const after = parseShowService(await askForService());

    expect(answer).toMatchObject({
      ok: true,
      value: {ok: true, value: {id: HYMN_ONE_ID, revision: 2}},
    });
    expect(after).toMatchObject({
      ok: true,
      value: {
        revision: 2,
        tiles: {[itemId(1)]: [{lines: ['새로 편집한 가사']}]},
      },
    });
    expect(
      electron.send.mock.calls.filter(
        ([channel]) => channel === Channels.serviceChanged,
      ),
    ).toHaveLength(1);
    expect(
      electron.send.mock.calls.some(
        ([channel]) => channel === Channels.liveChanged,
      ),
    ).toBe(false);
    expect(
      electron.send.mock.calls.some(
        ([channel]) => channel === Channels.songsDocumentChanged,
      ),
    ).toBe(true);
    await store.dispose();

    expect(parseSong(await readFile(file, 'utf8'), file)).toMatchObject({
      ok: true,
      value: {
        data: {
          slides: [{lines: ['새로 편집한 가사']}],
          future: {enabled: true},
        },
      },
    });
    expect(electron.handlers.size).toBe(0);
  });

  it('reads and edits content requested while the data is still loading', async () => {
    const context = await developmentContext();
    const store = await register(fakeLog(), context, () => true);

    const created = parseEditResult(
      await ask(Channels.contentEdit, {type: 'song.create'}),
    );
    if (!created.ok || !created.value.ok) {
      throw new Error('Could not create a test song');
    }
    expect(await ask(Channels.songsList)).toMatchObject([
      {id: created.value.value.id, title: '새 곡'},
    ]);
    expect(
      await ask(Channels.songsDocumentGet, created.value.value.id),
    ).toMatchObject({revision: 1, access: 'editable'});
    await store.dispose();
    expect(electron.handlers.size).toBe(0);
  });

  it('logs and refuses malformed edits and document ids without changing files', async () => {
    const context = await developmentContext();
    const log = fakeLog();
    await register(log, context, () => true);

    expect(
      await ask(Channels.contentEdit, {type: 'song.update', song: {}}),
    ).toMatchObject({ok: false, error: {reason: 'invalid'}});
    expect(await ask(Channels.songsDocumentGet, '../outside')).toBeNull();
    expect(await ask(Channels.servicesDocumentGet, 7)).toBeNull();
    expect(await ask(Channels.templatesDocumentGet, null)).toBeNull();
    expect(await ask(Channels.songsList)).toEqual([]);
    expect(log.warn).toHaveBeenCalledTimes(4);
  });

  it('answers content reads and edits safely when no data folder could be opened', async () => {
    const log = fakeLog();
    const appConfig = await openAppConfig({
      file: join(await makeTempDir(), 'app.json'),
      log,
    });
    const store = registerStore({
      log,
      appConfig,
      isAnyOutputOn: () => false,
      context: () => {
        throw new Error('missing data');
      },
    });
    disposers.push(store.dispose);

    expect(
      await ask(Channels.contentEdit, {type: 'song.create'}),
    ).toMatchObject({ok: false, error: {reason: 'not-found'}});
    expect(await ask(Channels.songsList)).toEqual([]);
    expect(await ask(Channels.servicesList)).toEqual([]);
    expect(await ask(Channels.templatesList)).toEqual([]);
    expect(await ask(Channels.songsDocumentGet, HYMN_ONE_ID)).toBeNull();
  });

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
    expect(await ask(Channels.preferencesGet)).toMatchObject({
      show: {showClearUndoButton: false},
    });
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
    expect(await ask(Channels.preferencesGet)).toMatchObject({
      show: {showClearUndoButton: false},
    });
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
