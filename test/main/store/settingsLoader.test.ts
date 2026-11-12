import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {isRecord} from '@core/common/guards';
import type {FileError} from '@core/schema/fileFormat';
import {parseSettingsDocument} from '@core/schema/settingsDocuments';
import {makeTempDir} from '@fixtures/tempDir';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {openAppConfig} from '@main/store/appConfigFile';
import {loadStore} from '@main/store/fileStore';
import {resolveLocations} from '@main/store/locations';
import type {ParseFile} from '@main/store/readFiles';
import {settingsCodecs} from '@main/store/settingsCodecs';
import {
  readSettingsFile,
  settingsLocation,
  type SettingsLocation,
  type SettingsRead,
} from '@main/store/settingsFile';
import {loadSettingsArea} from '@main/store/settingsLoader';
import {openSettingsStore, SettingsStore} from '@main/store/settingsStore';
import {createDefaultThemes} from '@core/themes/defaults';
import {createThemeId} from '@core/schema/ids';
import type {Saver} from '@main/store/saver';
import type {DocumentFiles} from '@main/store/contentPersistence';
import {writeJson} from '@fixtures/main/store/testFiles';

vi.mock('@core/schema/settingsDocuments', async importOriginal => {
  const actual =
    await importOriginal<typeof import('@core/schema/settingsDocuments')>();
  return {
    ...actual,
    parseSettingsDocument: vi.fn(actual.parseSettingsDocument),
  };
});
vi.mock('@main/store/settingsFile', async importOriginal => {
  const actual =
    await importOriginal<typeof import('@main/store/settingsFile')>();
  return {...actual, readSettingsFile: vi.fn(actual.readSettingsFile)};
});

const {locations} = resolveLocations(
  {},
  {documents: resolve('/loader-tests'), developmentFolder: null},
);

function mockSaver() {
  return {
    save: vi.fn<Saver['save']>(() =>
      Promise.resolve({ok: true, value: undefined}),
    ),
  };
}

/** Makes the next read find a file with this text, as readSettingsFile parses one. */
function readsText(text: string, problems: readonly FileError[] = []) {
  vi.mocked(readSettingsFile).mockImplementationOnce(
    async <T>(
      location: SettingsLocation,
      parse: ParseFile<T>,
    ): Promise<SettingsRead<T>> => {
      const parsed = parse(text, location.file);
      if (!parsed.ok) throw new Error(parsed.error.message);
      return {data: parsed.value.data, problems};
    },
  );
}

function readsNothing() {
  vi.mocked(readSettingsFile).mockResolvedValueOnce({data: null, problems: []});
}

function problem(kind: FileError['kind'], name: string): FileError {
  return {
    kind,
    file: settingsLocation(locations, name).file,
    field: '',
    message: kind,
  };
}

async function withParseFailure<T>(
  failing: (value: unknown) => boolean,
  run: () => Promise<T>,
): Promise<T> {
  const actual = await vi.importActual<
    typeof import('@core/schema/settingsDocuments')
  >('@core/schema/settingsDocuments');
  vi.mocked(parseSettingsDocument).mockImplementation(value =>
    failing(value)
      ? {
          ok: false,
          error: {kind: 'invalid', file: '', field: '', message: 'Bad'},
        }
      : actual.parseSettingsDocument(value),
  );
  try {
    return await run();
  } finally {
    vi.mocked(parseSettingsDocument).mockImplementation(
      actual.parseSettingsDocument,
    );
  }
}

describe('loadSettingsArea', () => {
  it('creates a missing file with the area defaults', async () => {
    const saver = mockSaver();
    readsNothing();

    const loaded = await loadSettingsArea('messages', locations, saver);

    expect(loaded.problem).toBeNull();
    expect(loaded.document).toMatchObject({
      name: 'messages',
      access: 'editable',
      revision: 1,
      value: {templates: []},
    });
    expect(saver.save).toHaveBeenCalledOnce();
    const [request] = saver.save.mock.calls[0] ?? [];
    expect(request?.target).toEqual({
      file: settingsLocation(locations, 'messages').file,
      kind: 'settings',
      id: 'messages',
    });
    expect(request?.text).toContain('"llsettings.messages"');
  });

  it('keeps the custom values of a file it read, adds no defaults, and saves nothing', async () => {
    const saver = mockSaver();
    const original = {
      format: 'llsettings.screens',
      schemaVersion: 1,
      screens: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          name: 'Renamed capture',
          kind: 'audience',
          method: 'capture',
          alwaysOnTop: true,
        },
        {
          id: '44444444-4444-4444-8444-444444444444',
          name: 'Unspecified',
          kind: 'audience',
          method: 'capture',
        },
      ],
    };
    readsText(JSON.stringify(original));

    const loaded = await loadSettingsArea('screens', locations, saver);

    expect(loaded.problem).toBeNull();
    expect(loaded.document?.value).toEqual(original);
    expect(saver.save).not.toHaveBeenCalled();
  });

  it('reports the first read problem, uses what was read, and saves nothing', async () => {
    const saver = mockSaver();
    readsText(
      JSON.stringify({format: 'llsettings.preferences', schemaVersion: 1}),
      [problem('invalid', 'preferences')],
    );

    const loaded = await loadSettingsArea('preferences', locations, saver);

    expect(loaded.problem).toEqual({
      file: 'preferences.json',
      error: problem('invalid', 'preferences'),
    });
    expect(loaded.document?.access).toBe('editable');
    expect(saver.save).not.toHaveBeenCalled();
  });

  it('opens an area read-only when its file is from a newer version', async () => {
    readsText(
      JSON.stringify({
        format: 'llsettings.labels',
        schemaVersion: 1,
        labels: [],
      }),
      [problem('newer', 'labels')],
    );

    const loaded = await loadSettingsArea('labels', locations, mockSaver());

    expect(loaded.document?.access).toBe('readOnly');
    expect(loaded.problem?.error.kind).toBe('newer');
  });

  it('uses the defaults and reports the area when the document it read does not validate', async () => {
    readsText(
      JSON.stringify({
        format: 'llsettings.labels',
        schemaVersion: 1,
        labels: [],
        trip: true,
      }),
    );
    const loaded = await withParseFailure(
      value =>
        isRecord(value) && isRecord(value.value) && value.value.trip === true,
      () => loadSettingsArea('labels', locations, mockSaver()),
    );

    expect(loaded.document?.name).toBe('labels');
    expect(loaded.document?.value).not.toHaveProperty('trip');
    expect(loaded.problem?.file).toBe('labels.json');
  });

  it('uses the defaults and reports the area when serializing its defaults throws or fails', async () => {
    const spy = vi.spyOn(settingsCodecs.messages, 'serialize');
    onTestFinished(() => spy.mockRestore());
    spy.mockImplementationOnce(() => {
      throw new Error('Serialization failed');
    });
    readsNothing();
    const thrown = await loadSettingsArea('messages', locations, mockSaver());
    expect(thrown.document?.value).toMatchObject({templates: []});
    expect(thrown.problem?.file).toBe('messages.json');

    spy.mockReturnValueOnce({
      ok: false,
      error: {kind: 'invalid', file: 'messages.json', field: '', message: 'No'},
    });
    readsNothing();
    const failed = await loadSettingsArea('messages', locations, mockSaver());
    expect(failed.document?.name).toBe('messages');
    expect(failed.problem?.error.message).toBe('No');
  });

  it('uses the defaults and reports the area when creating its file fails', async () => {
    const saver = mockSaver();
    saver.save.mockResolvedValueOnce({
      ok: false,
      error: {file: 'messages.json', message: 'Disk is full'},
    });
    readsNothing();

    const loaded = await loadSettingsArea('messages', locations, saver);

    expect(loaded.document?.name).toBe('messages');
    expect(loaded.problem).toMatchObject({
      file: 'messages.json',
      error: {message: 'Disk is full'},
    });
  });

  it('retains read themes after a failed startup rewrite and preserves them on the next save', async () => {
    const defaults = createDefaultThemes();
    const builtin = defaults.themes[0];
    if (builtin === undefined) {
      throw new Error('Missing built-in theme');
    }
    const edited = {...builtin, edited: true, name: 'Edited'};
    const user = {
      ...builtin,
      id: createThemeId('11111111-1111-4111-8111-111111111111'),
      name: 'User',
    };
    readsText(JSON.stringify({...defaults, themes: [edited, user]}));
    const saver = mockSaver();
    saver.save.mockResolvedValueOnce({
      ok: false,
      error: {file: 'themes.json', message: 'Disk full'},
    });
    const loaded = await loadSettingsArea('themes', locations, saver);
    expect(loaded.problem?.error.message).toBe('Disk full');
    const document = loaded.document;
    if (document?.name !== 'themes') {
      throw new Error('Missing themes');
    }
    expect(document.value.themes).toContainEqual(edited);
    expect(document.value.themes).toContainEqual(user);
    const write = vi
      .fn<DocumentFiles['write']>()
      .mockResolvedValue({ok: true, value: undefined});
    const store = new SettingsStore({
      documents: new Map([['themes', document]]),
      problems: [],
      log: recordingLogger(),
      saving: {
        folder: '/settings',
        files: {write, remove: async () => ({ok: true, value: undefined})},
        delayMs: 0,
      },
    });
    onTestFinished(() => store.dispose());
    const result = await store.apply({
      type: 'settings.update',
      name: 'themes',
      value: document.value,
      baseRevision: 1,
    });
    expect(result.ok).toBe(true);
    const request = write.mock.calls[0]?.[0];
    if (request === undefined) {
      throw new Error('Missing save request');
    }
    const saved: unknown = JSON.parse(request.text);
    expect(saved).toMatchObject({themes: [edited, user]});
  });

  it('returns no document and reports the area when its defaults cannot be built', async () => {
    readsNothing();
    const loaded = await withParseFailure(
      value => isRecord(value) && value.name === 'messages',
      () => loadSettingsArea('messages', locations, mockSaver()),
    );

    expect(loaded.document).toBeNull();
    expect(loaded.problem?.file).toBe('messages.json');
  });
});

describe('openSettingsStore', () => {
  it('does not make an incompatible newer original editable through an older recovery copy', async () => {
    const folder = await makeTempDir();
    const log = recordingLogger();
    const appConfig = await openAppConfig({
      file: join(folder, 'app.json'),
      log,
    });
    const opened = await loadStore({
      documents: folder,
      developmentFolder: folder,
      appConfig,
    });
    if (!opened.ok) throw new Error(opened.error.message);
    const loaded = opened.value;
    const file = join(loaded.locations.settings, 'labels.json');
    const original = JSON.stringify({
      format: 'llsettings.labels',
      schemaVersion: 2,
      labels: 'future-shape',
    });
    await mkdir(loaded.locations.settings, {recursive: true});
    await writeFile(file, original);
    await writeJson(
      join(
        loaded.locations.recovery,
        'settings',
        'labels',
        '2026-10-25T09-00-00.000Z.json',
      ),
      {format: 'llsettings.labels', schemaVersion: 1, labels: []},
    );
    const store = await openSettingsStore(loaded, log);
    onTestFinished(() => store.dispose());

    expect(store.get('labels').access).toBe('readOnly');
    expect(
      await store.apply({
        type: 'settings.update',
        name: 'labels',
        value: {format: 'llsettings.labels', schemaVersion: 1, labels: []},
        baseRevision: 1,
      }),
    ).toMatchObject({ok: false, error: {reason: 'read-only'}});
    expect(await readFile(file, 'utf8')).toBe(original);
    expect(
      log
        .messages('warn')
        .filter(message => message === 'skipped a data file or a part of one'),
    ).toHaveLength(1);
  });
});
