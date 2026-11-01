import {join} from 'node:path';
import {expect, it, onTestFinished, vi} from 'vitest';
import {makeTempDir} from '../../temp-dir';
import type {BibleLookupSession} from '@main/bible/lookup';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {openAppConfig} from '@main/store/appConfigFile';
import {loadStore} from '@main/store/fileStore';
import {openContent} from '@main/store/openContent';

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
