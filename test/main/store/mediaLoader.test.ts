import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it, onTestFinished, vi} from 'vitest';
import * as mediaListSchema from '@core/schema/mediaList';
import {makeTempDir} from '@fixtures/tempDir';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {openAppConfig} from '@main/store/appConfigFile';
import {loadStore} from '@main/store/fileStore';
import {openMediaStore} from '@main/store/mediaLoader';
import {Saver} from '@main/store/saver';
import {writeJson} from '@fixtures/main/store/testFiles';

const EMPTY = {
  format: 'llmedia',
  schemaVersion: 1,
  items: [],
  playlists: [],
  audioPlaylists: [],
};
const ID = '00000000-0000-4000-8000-000000000001';

async function setup() {
  const folder = await makeTempDir();
  const log = recordingLogger();
  const config = await openAppConfig({file: join(folder, 'app.json'), log});
  const loaded = await loadStore({
    documents: folder,
    developmentFolder: folder,
    appConfig: config,
  });
  if (!loaded.ok) throw new Error(loaded.error.message);
  return {loaded: loaded.value, log};
}

describe('media list loading', () => {
  it('keeps defaults and a file problem when default serialization unexpectedly fails', async () => {
    const {loaded, log} = await setup();
    vi.spyOn(mediaListSchema, 'serializeMediaList').mockImplementationOnce(
      () => {
        throw new Error('Serializer failed');
      },
    );
    const opened = await openMediaStore(loaded, {settings: null, log});
    onTestFinished(() => opened.store.dispose());
    expect(opened.store.get().value).toEqual(EMPTY);
    expect(opened.problems).toMatchObject([
      {file: 'media.json', error: {message: 'Serializer failed'}},
    ]);
  });
  it('keeps defaults and reports the error when the default list cannot be serialized', async () => {
    const {loaded, log} = await setup();
    vi.spyOn(mediaListSchema, 'serializeMediaList').mockReturnValueOnce({
      ok: false,
      error: {kind: 'invalid', file: 'media.json', field: '', message: 'No'},
    });
    const opened = await openMediaStore(loaded, {settings: null, log});
    onTestFinished(() => opened.store.dispose());
    expect(opened.store.get().value).toEqual(EMPTY);
    expect(opened.problems).toMatchObject([
      {file: 'media.json', error: {message: 'No'}},
    ]);
    await expect(
      readFile(join(loaded.locations.settings, 'media.json'), 'utf8'),
    ).rejects.toThrow();
  });

  it('keeps defaults and reports the cause when the first file cannot be created', async () => {
    const {loaded, log} = await setup();
    vi.spyOn(Saver.prototype, 'save').mockResolvedValueOnce({
      ok: false,
      error: {file: 'media.json', message: 'Disk is full'},
    });
    const opened = await openMediaStore(loaded, {settings: null, log});
    onTestFinished(() => opened.store.dispose());
    expect(opened.store.get().value).toEqual(EMPTY);
    expect(opened.problems).toMatchObject([
      {file: 'media.json', error: {message: 'Disk is full'}},
    ]);
  });

  it('creates a missing empty media list', async () => {
    const {loaded, log} = await setup();
    const opened = await openMediaStore(loaded, {settings: null, log});
    onTestFinished(() => opened.store.dispose());
    expect(opened.problems).toEqual([]);
    expect(opened.store.get()).toEqual({
      name: 'media',
      access: 'editable',
      revision: 1,
      value: EMPTY,
    });
    expect(
      JSON.parse(
        await readFile(join(loaded.locations.settings, 'media.json'), 'utf8'),
      ),
    ).toEqual(EMPTY);
  });

  it('keeps a broken original while defaults and the startup problem remain available', async () => {
    const {loaded, log} = await setup();
    const file = join(loaded.locations.settings, 'media.json');
    await writeJson(file, '{"format":');
    const opened = await openMediaStore(loaded, {settings: null, log});
    onTestFinished(() => opened.store.dispose());
    expect(opened.store.get().value).toEqual(EMPTY);
    expect(opened.problems).toMatchObject([
      {file: 'media.json', error: {kind: 'json'}},
    ]);
    expect(await readFile(file, 'utf8')).toBe('{"format":');
  });

  it('keeps a newer incompatible original read-only even when a recovery copy is editable', async () => {
    const {loaded, log} = await setup();
    const file = join(loaded.locations.settings, 'media.json');
    const original = JSON.stringify({
      ...EMPTY,
      schemaVersion: 2,
      items: 'future-shape',
    });
    await writeJson(file, original);
    await writeJson(
      join(
        loaded.locations.recovery,
        'settings',
        'media',
        '2026-10-25T09-00-00.000Z.json',
      ),
      EMPTY,
    );
    const opened = await openMediaStore(loaded, {settings: null, log});
    onTestFinished(() => opened.store.dispose());
    expect(opened.store.get()).toMatchObject({
      access: 'readOnly',
      value: EMPTY,
    });
    expect(
      await opened.store.apply({type: 'media.playlist.create', kind: 'media'}),
    ).toMatchObject({ok: false, error: {reason: 'read-only'}});
    expect(await readFile(file, 'utf8')).toBe(original);
  });

  it('reports refused stored paths without hiding the rest of the catalog', async () => {
    const {loaded, log} = await setup();
    await writeJson(join(loaded.locations.settings, 'media.json'), {
      ...EMPTY,
      items: [
        {
          id: ID,
          name: 'Invented video',
          kind: 'video',
          file: '../outside.webm',
          size: 1,
        },
      ],
    });
    const opened = await openMediaStore(loaded, {settings: null, log});
    onTestFinished(() => opened.store.dispose());
    expect(opened.store.get().value.items).toHaveLength(1);
    expect(opened.store.fileOf(ID)).toBeNull();
    expect(opened.problems).toMatchObject([
      {file: 'media.json', error: {field: 'items.0.file'}},
    ]);
    expect(log.messages('warn')).toContain(
      'skipped a data file or a part of one',
    );
  });
});
