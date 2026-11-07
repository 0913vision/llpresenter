import {join} from 'node:path';
import {expect, it, onTestFinished, vi} from 'vitest';
import {makeTempDir} from '@fixtures/tempDir';
import type {BibleLookupSession} from '@main/bible/lookup';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {openAppConfig} from '@main/store/appConfigFile';
import {loadStore} from '@main/store/fileStore';
import {defaultPreferences} from '@core/schema/preferences';
import {openContent} from '@main/store/openContent';
import {SettingsStore} from '@main/store/settingsStore';

async function setup() {
  const folder = await makeTempDir();
  const log = recordingLogger();
  const appConfig = await openAppConfig({file: join(folder, 'app.json'), log});
  const loaded = await loadStore({
    documents: folder,
    developmentFolder: folder,
    appConfig,
  });
  if (!loaded.ok) throw new Error(loaded.error.message);
  const readers = {
    settings: Promise.resolve(null),
    media: Promise.resolve(null),
    failures: {waiting: vi.fn(), saved: vi.fn(), remind: vi.fn()},
    bible: {lookup: vi.fn<BibleLookupSession['lookup']>()},
  };
  return {store: loaded.value, log, readers};
}

it('logs a reader that fails to open and returns no content', async () => {
  const {store, log, readers} = await setup();
  const failure = new Error('invented reader failure');
  const opened = await openContent(Promise.resolve(store), log, {
    ...readers,
    settings: Promise.reject(failure),
  });
  expect(opened).toBeNull();
  expect(log.entries).toEqual([
    expect.objectContaining({level: 'error', detail: failure}),
  ]);
});

it('falls back to the loaded store labels and media backgrounds while the settings and the media list are missing', async () => {
  const {store, log, readers} = await setup();
  const background = vi
    .spyOn(store.media, 'backgroundOf')
    .mockResolvedValue(null);
  const opened = await openContent(Promise.resolve(store), log, readers);
  if (opened === null) throw new Error('the content did not open');
  onTestFinished(async () => {
    opened.removeSettings();
    await opened.content.flush();
    opened.content.dispose();
  });
  expect(opened.library.labels).toBe(store.labels);
  expect(await opened.library.backgroundOf('invented-media')).toBeNull();
  expect(background).toHaveBeenCalledWith('invented-media');
});

it('refreshes the open service for 환경설정 only for labels and Bible changes, never for another 환경설정 change', async () => {
  const {store, log, readers} = await setup();
  const settings = new SettingsStore({
    documents: new Map([
      [
        'preferences',
        {
          name: 'preferences',
          access: 'editable',
          revision: 1,
          value: {format: defaultPreferences.format, schemaVersion: 1},
        },
      ],
    ]),
    problems: [],
    log,
    saving: {
      folder: '/settings',
      files: {
        write: () => Promise.resolve({ok: true, value: undefined}),
        remove: () => Promise.resolve({ok: true, value: undefined}),
      },
    },
  });
  onTestFinished(() => settings.dispose());
  const opened = await openContent(Promise.resolve(store), log, {
    ...readers,
    settings: Promise.resolve(settings),
  });
  if (opened === null) throw new Error('the content did not open');
  onTestFinished(async () => {
    opened.removeSettings();
    await opened.content.flush();
    opened.content.dispose();
  });
  const refresh = vi.spyOn(opened.feed, 'refresh');
  const change = async (general: object) => {
    const document = settings.get('preferences');
    if (document.name !== 'preferences') throw new Error('Not preferences');
    await settings.apply({
      type: 'settings.update',
      name: 'preferences',
      baseRevision: document.revision,
      value: {...document.value, general},
    });
  };
  await change({launchAtLogin: true});
  await change({launchAtLogin: false});
  expect(refresh).not.toHaveBeenCalled();
});
