import {fixtureSlideId} from '@fixtures/core/songs/slideFixtures';
import {
  ask,
  askForService,
  developmentContext,
  electron,
  mockLog,
  register,
} from '@fixtures/main/store/registerFixtures';
import {mediaEndpoints} from '@contracts/ipc/media';
import {settingsEndpoints} from '@contracts/ipc/settings';
import {createMediaId} from '@core/schema/ids';
import {parseMediaDocument} from '@core/schema/mediaEdit';
import {readFile, readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {DATA_FOLDER_NAME} from '@main/store/locations';
import {itemId, writeJson} from '@fixtures/main/store/testFiles';

describe('registerStore', () => {
  it('opens a fresh user data folder with no media or copied theme pictures', async () => {
    const context = await developmentContext();
    const registered = await register(mockLog(), context, () => true);
    const media = await registered.media;
    expect(media?.get().value.items).toEqual([]);
    expect(await ask(mediaEndpoints.get.channel)).toMatchObject({
      value: {items: []},
    });
    await expect(
      readdir(join(context.appDataFolder, DATA_FOLDER_NAME, 'Media')),
    ).rejects.toMatchObject({code: 'ENOENT'});
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
      slides: [{id: fixtureSlideId(1), lines: ['Invented line']}],
    });
    await writeJson(join(root, 'Services', `${itemId(3)}.llservice`), {
      format: 'llservice',
      schemaVersion: 1,
      id: itemId(3),
      name: 'Invented service',
      date: '2026-10-26T10:00',
      order: [{slides: [], id: itemId(4), song: songId}],
    });
    const registered = await register(mockLog(), context, () => true);
    const content = await registered.content;
    expect(content?.openServiceId).toBe(itemId(3));
    expect(content?.service(itemId(3))?.service.order).toEqual([
      {slides: [], id: itemId(4), song: songId},
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
      await ask(settingsEndpoints.get.channel, {name: 'props'}),
    ).toMatchObject({
      name: 'props',
    });
    expect(problems).toEqual(['media.json']);
    expect(await readFile(file, 'utf8')).toBe('{broken media');
    stop();
  });
});
