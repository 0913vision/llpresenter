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
  songDocument,
} from './testing/registerFixtures';
import {contentEndpoints} from '@contracts/ipc/content';
import {libraryEndpoints} from '@contracts/ipc/library';
import {liveEndpoints} from '@contracts/ipc/live';
import {mediaEndpoints} from '@contracts/ipc/media';
import {serviceEndpoints} from '@contracts/ipc/service';
import {settingsEndpoints} from '@contracts/ipc/settings';
import {chunkedTranslationFile} from '@core/bible/testing/testFiles';
import type {AppProblem} from '@core/schema/appProblem';
import {parseBibleLookupRequest} from '@core/schema/bibleLookup';
import {parseServiceDocument} from '@core/schema/contentDocuments';
import {parseEditResult} from '@core/schema/contentEdit';
import {parseGroupedSong} from '@core/schema/groupedSong';
import {createMediaId} from '@core/schema/ids';
import {parseMediaDocument} from '@core/schema/mediaEdit';
import {parsePreferencesValue} from '@core/schema/preferences';
import {
  parseSettingsDocument,
  settingsNames,
  type SettingsDocument,
} from '@core/schema/settingsDocuments';
import {parseShowService} from '@core/schema/showService';
import {
  mkdir,
  readdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {makeTempDir} from '../../../test/temp-dir';
import * as chapterFile from '../bible/chapterFile';
import {openAppConfig} from './appConfigFile';
import * as atomicWrite from './atomicWrite';
import {DATA_FOLDER_NAME} from './locations';
import {electronLocationContext, registerStore} from './register';
import type {SettingsProblemListener} from './settingsStore';
import {
  HYMN_ONE_ID,
  hymnOne,
  itemId,
  service,
  SUNDAY_ID,
  writeJson,
} from './testFiles';

describe('registerStore', () => {
  it('projects saved Bible items from the installed chunked translation and refreshes removed translations', async () => {
    const context = await developmentContext();
    const root = join(context.appDataFolder, DATA_FOLDER_NAME);
    const bibleFolder = join(context.appDataFolder, 'bible');
    await mkdir(bibleFolder, {recursive: true});
    await writeFile(
      join(bibleFolder, 'sample.llbible'),
      chunkedTranslationFile().bytes,
    );
    const bibleItem = {
      id: itemId(60),
      bible: {
        translation: 'sample',
        ref: '요한복음 3:16-18',
        split: 'verse',
        reference: 'every',
        verseNumbers: false,
        translationName: false,
      },
    };
    await writeJson(
      join(root, 'Services', `${SUNDAY_ID}.llservice`),
      service(SUNDAY_ID, '2026-11-01T11:00', [
        bibleItem,
        {
          ...bibleItem,
          id: itemId(61),
          bible: {...bibleItem.bible, ref: '창세기 1:1'},
        },
      ]),
    );
    await writeJson(join(root, 'Settings', 'bible.json'), {
      format: 'llsettings.bible',
      schemaVersion: 1,
      recents: [],
      translations: [
        {
          id: 'sample',
          name: 'Invented',
          lang: 'ko',
          file: 'sample.llbible',
          default: true,
        },
      ],
    });
    const readChapter = vi.spyOn(chapterFile, 'readBibleChapter');
    const store = await register(mockLog(), context, () => true);
    const shown = parseShowService(await askForService());
    if (!shown.ok || shown.value === null) {
      throw new Error('Missing projected service');
    }
    expect(shown.value.tiles[itemId(60)]).toMatchObject([
      {label: '3:16', lines: ['Invented book 43, chapter 3, verse 16']},
      {label: '3:17'},
      {label: '3:18'},
    ]);
    expect(shown.value.rows).toEqual([
      {
        kind: 'bible',
        id: itemId(60),
        title: '요한복음 3:16-18',
        bible: {
          ref: '요한복음 3:16-18',
          translation: 'sample',
          verseNumbers: false,
        },
      },
      {
        kind: 'bible',
        id: itemId(61),
        title: '창세기 1:1',
        problem: 'missing-bible',
      },
    ]);
    const reader = store.bible;
    const request = parseBibleLookupRequest({
      translation: 'sample',
      input: '요한복음 3:16-18',
    });
    if (!request.ok) throw new Error('Invalid request fixture');
    expect((await reader.lookup(request.value)).result.ok).toBe(true);
    expect(readChapter).toHaveBeenCalledOnce();
    const document = (await store.settings)?.get('bible');
    if (document?.name !== 'bible') throw new Error('Missing Bible document');
    expect(
      await ask(settingsEndpoints.edit.channel, {
        type: 'settings.update',
        name: 'bible',
        baseRevision: document.revision,
        value: {...document.value, translations: []},
      }),
    ).toMatchObject({ok: true});
    const removed = parseShowService(await askForService());
    if (!removed.ok || removed.value === null) {
      throw new Error('Missing refreshed service');
    }
    expect(removed.value.tiles).toEqual({});
    for (const row of removed.value.rows) {
      expect(row).not.toHaveProperty('bible');
    }
    expect(
      removed.value.rows.every(
        row => row.kind !== 'header' && row.problem === 'missing-bible',
      ),
    ).toBe(true);
    await store.dispose();
    await expect(reader.lookup(request.value)).rejects.toThrow(
      'Bible lookup is unavailable',
    );
  });

  it('refreshes the open service from edited media and leaves deleted media bytes intact', async () => {
    const context = await developmentContext();
    const root = join(context.appDataFolder, DATA_FOLDER_NAME);
    const mediaId = createMediaId(itemId(1));
    const songId = itemId(2);
    const mediaFile = join(root, 'Media', 'invented.webm');
    await writeJson(mediaFile, 'Invented file bytes');
    await writeJson(join(root, 'Settings', 'media.json'), {
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
    await writeJson(join(root, 'Songs', `${songId}.llsong`), {
      format: 'llsong',
      schemaVersion: 1,
      id: songId,
      title: 'Invented song',
      background: mediaId,
      slides: [{lines: ['Invented line']}],
    });
    await writeJson(join(root, 'Services', `${itemId(3)}.llservice`), {
      format: 'llservice',
      schemaVersion: 1,
      id: itemId(3),
      name: 'Invented service',
      date: '2026-10-26T10:00',
      order: [{id: itemId(4), song: songId}],
    });
    const registered = await register(mockLog(), context, () => true);
    const content = await registered.content;
    expect(content?.openServiceId).toBe(itemId(3));
    expect(content?.service(itemId(3))?.service.order).toEqual([
      {id: itemId(4), song: songId},
    ]);
    expect(await askForService()).toMatchObject({
      rows: [{background: {mediaId, loop: true}}],
    });
    expect(
      await ask(mediaEndpoints.edit.channel, {
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
      await ask(mediaEndpoints.edit.channel, {type: 'media.delete', mediaId}),
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
    const file = join(root, 'Settings', 'media.json');
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
    const first = await register(mockLog(), context, () => true);
    const initial = parseMediaDocument(await ask(mediaEndpoints.get.channel));
    if (!initial.ok) throw new Error(initial.error.message);
    expect(await first.findMediaFile(id)).toBe(join(root, 'Media', 'old.webm'));
    electron.send.mockClear();
    expect(
      await ask(mediaEndpoints.edit.channel, {
        type: 'media.properties.update',
        mediaId: id,
        baseRevision: 1,
        changes: {name: 'After'},
      }),
    ).toMatchObject({ok: true, value: {revision: 2}});
    expect(electron.send).toHaveBeenCalledWith(
      mediaEndpoints.changed.channel,
      await ask(mediaEndpoints.get.channel),
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
    expect(await first.findMediaFile(id)).toBe(join(root, 'Media', 'new.webm'));
    expect(first.mediaRoots()).toEqual([join(root, 'Media')]);
    expect(JSON.parse(await readFile(file, 'utf8'))).toHaveProperty(
      'future',
      'kept',
    );
    expect(JSON.parse(await readFile(file, 'utf8'))).toHaveProperty(
      'items.0.props.future',
      'kept',
    );
    await first.dispose();
    const second = await register(mockLog(), context, () => true);
    expect(await ask(mediaEndpoints.get.channel)).toMatchObject({
      revision: 1,
      value: {items: [{name: 'After', file: 'new.webm'}]},
    });
    expect(
      await ask(mediaEndpoints.edit.channel, {
        type: 'media.delete',
        mediaId: id,
      }),
    ).toMatchObject({ok: true});
    expect(await second.findMediaFile(id)).toBeNull();
  });

  it('creates missing media data and replays one media problem while other settings stay readable', async () => {
    const context = await developmentContext();
    const root = join(context.appDataFolder, DATA_FOLDER_NAME);
    const file = join(root, 'Settings', 'media.json');
    const first = await register(mockLog(), context, () => true);
    expect(await ask(mediaEndpoints.get.channel)).toMatchObject({
      value: {items: [], playlists: [], audioPlaylists: []},
    });
    expect(JSON.parse(await readFile(file, 'utf8'))).toMatchObject({
      format: 'llmedia',
    });
    await first.dispose();
    await writeJson(file, '{broken media');
    const second = await register(mockLog(), context, () => true);
    const problems: string[] = [];
    const stop = second.subscribeSettingsProblems(problem =>
      problems.push(problem.file),
    );
    await ask(mediaEndpoints.get.channel);
    expect(
      await ask(settingsEndpoints.get.channel, {name: 'notices'}),
    ).toMatchObject({
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
      await writeJson(join(root, 'Services', `${id}.llservice`), {
        format: 'llservice',
        schemaVersion: 1,
        id,
        name: `Invented service ${index}`,
        date: '2026-10-26T10:00',
        order: [],
      });
    }
    const first = await register(mockLog(), context, () => true);
    expect(await askForService()).toMatchObject({id: firstId});
    expect(
      await ask(serviceEndpoints.open.channel, {serviceId: itemId(9)}),
    ).toBeNull();
    expect(await askForService()).toMatchObject({id: firstId});
    const current = await ask(contentEndpoints.services.get.channel, firstId);
    const parsed = parseServiceDocument(current);
    if (!parsed.ok || parsed.value === null) {
      throw new Error('Missing fixture service');
    }
    await ask(contentEndpoints.edit.channel, {
      type: 'service.update',
      service: {...parsed.value.service, name: 'Edited current service'},
      baseRevision: 1,
    });
    electron.send.mockClear();
    expect(
      await ask(serviceEndpoints.open.channel, {serviceId: secondId}),
    ).toMatchObject({id: secondId});
    expect(await askForService()).toMatchObject({id: secondId});
    expect(
      JSON.parse(
        await readFile(join(root, 'Services', `${firstId}.llservice`), 'utf8'),
      ),
    ).toMatchObject({name: 'Edited current service'});
    expect(JSON.parse(await readFile(appFile, 'utf8'))).toMatchObject({
      lastServiceId: secondId,
      uiZoomPercent: 120,
      future: 'kept',
    });
    expect(electron.send).toHaveBeenCalledWith(
      serviceEndpoints.changed.channel,
      expect.objectContaining({id: secondId}),
    );
    expect(electron.send).not.toHaveBeenCalledWith(
      liveEndpoints.changed.channel,
      expect.anything(),
    );
    await first.dispose();
    await register(mockLog(), context, () => true);
    expect(await askForService()).toMatchObject({id: secondId});
  });

  it('keeps the current service and saved launch choice when saving its pending edit fails', async () => {
    const context = await developmentContext();
    const root = join(context.appDataFolder, DATA_FOLDER_NAME);
    const firstId = itemId(1);
    const secondId = itemId(2);
    const appFile = join(context.appDataFolder, 'app.json');
    const firstFile = join(root, 'Services', `${firstId}.llservice`);
    await writeJson(appFile, {
      format: 'llapp',
      schemaVersion: 1,
      lastServiceId: firstId,
    });
    for (const [index, id] of [firstId, secondId].entries()) {
      await writeJson(join(root, 'Services', `${id}.llservice`), {
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
    await register(mockLog(), context, () => true);
    await askForService();
    const parsed = parseServiceDocument(
      await ask(contentEndpoints.services.get.channel, firstId),
    );
    if (!parsed.ok || parsed.value === null) {
      throw new Error('Missing fixture service');
    }
    await ask(contentEndpoints.edit.channel, {
      type: 'service.update',
      service: {...parsed.value.service, name: 'Unsaved current service'},
      baseRevision: 1,
    });
    expect(
      await ask(serviceEndpoints.open.channel, {serviceId: secondId}),
    ).toBeNull();
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
    await writeJson(join(folder, 'looks.json'), {format: 'wrong'});
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
    expect(electron.handlers.has(settingsEndpoints.get.channel)).toBe(false);
    const late = vi.fn();
    store.subscribeSettingsProblems(late);
    await Promise.resolve();
    expect(late).not.toHaveBeenCalled();
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

  it('pushes edited song tiles without a live-state push and flushes before disposal', async () => {
    const context = await developmentContext();
    const root = join(context.appDataFolder, DATA_FOLDER_NAME);
    const file = join(root, 'Songs', 'original-name.llsong');
    await writeJson(file, {...hymnOne(), future: {enabled: true}});
    await writeJson(
      join(root, 'Services', 'open.llservice'),
      service(SUNDAY_ID, '2026-11-01T11:00', [
        {id: itemId(1), song: HYMN_ONE_ID},
      ]),
    );
    const store = await register(mockLog(), context, () => true);
    const before = parseShowService(await askForService());
    if (!before.ok || before.value === null) {
      throw new Error('Missing test service');
    }
    const current = (await songDocument(HYMN_ONE_ID)).song;
    const edited = {
      ...current,
      groups: current.groups
        .slice(0, 1)
        .map(group => ({...group, slides: [{lines: ['새로 편집한 가사']}]})),
      arrangements: [],
    };

    const answer = parseEditResult(
      await ask(contentEndpoints.edit.channel, {
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
        ([channel]) => channel === serviceEndpoints.changed.channel,
      ),
    ).toHaveLength(1);
    expect(
      electron.send.mock.calls.some(
        ([channel]) => channel === liveEndpoints.changed.channel,
      ),
    ).toBe(false);
    expect(
      electron.send.mock.calls.some(
        ([channel]) => channel === contentEndpoints.songs.changed.channel,
      ),
    ).toBe(true);
    await store.dispose();

    expect(parseGroupedSong(await readFile(file, 'utf8'), file)).toMatchObject({
      ok: true,
      value: {
        data: {
          groups: [{slides: [{lines: ['새로 편집한 가사']}]}],
          future: {enabled: true},
        },
      },
    });
    expect(electron.handlers.size).toBe(0);
  });

  it('reads and edits content requested while the data is still loading', async () => {
    const context = await developmentContext();
    const store = await register(mockLog(), context, () => true);

    const created = parseEditResult(
      await ask(contentEndpoints.edit.channel, {type: 'song.create'}),
    );
    if (!created.ok || !created.value.ok) {
      throw new Error('Could not create a test song');
    }
    expect(await ask(contentEndpoints.songs.list.channel)).toMatchObject([
      {id: created.value.value.id, title: '새 곡'},
    ]);
    expect(
      await ask(contentEndpoints.songs.get.channel, created.value.value.id),
    ).toMatchObject({revision: 1, access: 'editable'});
    await store.dispose();
    expect(electron.handlers.size).toBe(0);
  });

  it('logs and refuses malformed edits and document ids without changing files', async () => {
    const context = await developmentContext();
    const log = mockLog();
    await register(log, context, () => true);

    expect(
      await ask(contentEndpoints.edit.channel, {type: 'song.update', song: {}}),
    ).toMatchObject({ok: false, error: {reason: 'invalid'}});
    expect(
      await ask(contentEndpoints.songs.get.channel, '../outside'),
    ).toBeNull();
    expect(await ask(contentEndpoints.services.get.channel, 7)).toBeNull();
    expect(await ask(contentEndpoints.templates.get.channel, null)).toBeNull();
    expect(await ask(contentEndpoints.songs.list.channel)).toEqual([]);
    expect(log.warn).toHaveBeenCalledTimes(4);
  });

  it('answers content reads and edits safely when no data folder could be opened', async () => {
    const log = mockLog();
    const appConfig = await openAppConfig({
      file: join(await makeTempDir(), 'app.json'),
      log,
    });
    const store = registerStore({
      problems: mockProblems(),
      log,
      appConfig,
      isAnyOutputOn: () => false,
      context: () => {
        throw new Error('missing data');
      },
    });
    disposers.push(store.dispose);

    expect(
      await ask(contentEndpoints.edit.channel, {type: 'song.create'}),
    ).toMatchObject({ok: false, error: {reason: 'not-found'}});
    expect(await ask(contentEndpoints.songs.list.channel)).toEqual([]);
    expect(await ask(contentEndpoints.services.list.channel)).toEqual([]);
    expect(await ask(contentEndpoints.templates.list.channel)).toEqual([]);
    expect(
      await ask(contentEndpoints.songs.get.channel, HYMN_ONE_ID),
    ).toBeNull();
  });

  it('answers service:get with the open 예배 순서 at its first revision', async () => {
    const context = await developmentContext();
    const root = join(context.appDataFolder, DATA_FOLDER_NAME);
    await writeJson(join(root, 'Songs', 'a.llsong'), hymnOne());
    await writeJson(
      join(root, 'Services', 'a.llservice'),
      service(SUNDAY_ID, '2026-11-01T11:00', [
        {id: itemId(1), song: HYMN_ONE_ID},
      ]),
    );
    const {dispose} = await register(mockLog(), context);

    expect(await askForService()).toMatchObject({
      revision: 1,
      id: SUNDAY_ID,
      rows: [{kind: 'song', id: itemId(1), title: '만복의 근원 하나님'}],
    });
    await dispose();
    expect(electron.handlers.has(serviceEndpoints.get.channel)).toBe(false);
  });

  it('answers null when there is no 예배 순서', async () => {
    const context = await developmentContext();
    const log = mockLog();
    await register(log, context);

    expect(await askForService()).toBeNull();
    expect(await ask(settingsEndpoints.preferences.channel)).toMatchObject({
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
