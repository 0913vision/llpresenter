import {
  ask,
  askForService,
  developmentContext,
  electron,
  mockLog,
  register,
  songDocument,
} from './testing/registerFixtures';
import {contentEndpoints} from '@contracts/ipc/content';
import {libraryEndpoints} from '@contracts/ipc/library';
import {liveEndpoints} from '@contracts/ipc/live';
import {serviceEndpoints} from '@contracts/ipc/service';
import {createMediaId} from '@core/schema/ids';
import {parseLibrarySearchResult} from '@core/schema/librarySearch';
import {parseShowService} from '@core/schema/showService';
import {readFile, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {DATA_FOLDER_NAME} from './locations';
import {
  HYMN_ONE_ID,
  hymnOne,
  itemId,
  service,
  SUNDAY_ID,
  writeJson,
} from './testFiles';

describe('content opening through registerStore', () => {
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
    await writeJson(join(root, 'Songs', `${song.id}.llsong`), song);
    const store = await register(mockLog(), context, () => true);
    expect(
      await ask(libraryEndpoints.showSong.channel, {songId: song.id}),
    ).toMatchObject({songRevision: 1});
    const current = (await songDocument(song.id)).song;
    expect(
      await ask(contentEndpoints.edit.channel, {
        type: 'song.update',
        baseRevision: 1,
        song,
      }),
    ).toMatchObject({ok: false, error: {reason: 'invalid'}});
    expect(
      await ask(contentEndpoints.edit.channel, {
        type: 'song.update',
        baseRevision: 1,
        song: {
          ...current,
          title: 'After edit',
          groups: current.groups.map(group => ({
            ...group,
            slides: [{lines: ['After']}],
          })),
        },
      }),
    ).toMatchObject({ok: true});
    expect(
      await ask(libraryEndpoints.showSong.channel, {songId: song.id}),
    ).toMatchObject({
      songRevision: 2,
      title: 'After edit',
      tiles: [{lines: ['After']}],
    });
    expect(
      await ask(contentEndpoints.edit.channel, {
        type: 'song.delete',
        songId: song.id,
      }),
    ).toMatchObject({ok: true});
    expect(
      await ask(libraryEndpoints.showSong.channel, {songId: song.id}),
    ).toBeNull();
    await store.dispose();
  });

  it('projects a standalone song, rechecks its background file, and leaves the service unchanged', async () => {
    const context = await developmentContext();
    const root = join(context.appDataFolder, DATA_FOLDER_NAME);
    const mediaId = createMediaId(itemId(80));
    const songId = itemId(81);
    const songFile = join(root, 'Songs', `${songId}.llsong`);
    const mediaFile = join(root, 'Media', 'standalone.webm');
    await writeJson(mediaFile, 'Invented media bytes');
    await writeJson(join(root, 'Settings', 'media.json'), {
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
      schemaVersion: 3,
      id: songId,
      title: 'Standalone invented song',
      background: mediaId,
      groups: [
        {id: itemId(82), name: 'Verse', slides: [{lines: ['First']}]},
        {id: itemId(83), name: '', slides: [{lines: ['Second']}]},
      ],
      arrangements: [
        {name: 'Other', groups: [itemId(83), itemId(82), itemId(83)]},
      ],
      future: 'kept',
    });
    const store = await register(mockLog(), context, () => true);
    const before = await askForService();
    const content = await store.content;
    const serviceId = content?.openServiceId;
    const shown = await ask(libraryEndpoints.showSong.channel, {songId});
    expect(shown).toMatchObject({
      songId,
      songRevision: 1,
      readOnly: true,
      problem: 'newer-version',
      tiles: [{lines: ['First']}, {lines: ['Second']}],
      background: {mediaId, loop: false},
    });
    expect(
      await ask(libraryEndpoints.showSong.channel, {songId: itemId(99)}),
    ).toBeNull();
    await rm(mediaFile);
    const missing = await ask(libraryEndpoints.showSong.channel, {songId});
    expect(missing).toMatchObject({
      readOnly: true,
      problem: 'missing-background',
    });
    expect(missing).not.toHaveProperty('background');
    expect(await askForService()).toEqual(before);
    expect(content?.openServiceId).toBe(serviceId);
    expect(
      electron.send.mock.calls.some(
        ([channel]) => channel === liveEndpoints.changed.channel,
      ),
    ).toBe(false);
    expect(JSON.parse(await readFile(songFile, 'utf8'))).toHaveProperty(
      'future',
      'kept',
    );
    await store.dispose();
    expect(electron.handlers.has(libraryEndpoints.showSong.channel)).toBe(
      false,
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
    await writeJson(join(root, 'Songs', 'song.llsong'), original);
    const store = await register(mockLog(), context, () => true);
    const initial = await ask(libraryEndpoints.search.channel, {
      query: '아침빛',
    });
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
    const current = (await songDocument(HYMN_ONE_ID)).song;
    const edited = {
      ...current,
      title: '바람의 노래',
      groups: current.groups.map(group => ({
        ...group,
        slides: [{lines: ['다시 피어난 햇살']}],
      })),
    };
    expect(
      await ask(contentEndpoints.edit.channel, {
        type: 'song.update',
        song: edited,
        baseRevision: 1,
      }),
    ).toMatchObject({ok: true});
    expect(
      await ask(libraryEndpoints.search.channel, {query: '햇살'}),
    ).toMatchObject({
      matches: [{title: '바람의 노래'}],
    });
    expect(
      await ask(libraryEndpoints.search.channel, {query: '아침빛'}),
    ).toMatchObject({
      matches: [],
    });
    expect(
      await ask(libraryEndpoints.search.channel, {query: '새벽의 길'}),
    ).toMatchObject({matches: []});
    expect(
      await ask(contentEndpoints.edit.channel, {
        type: 'song.delete',
        songId: HYMN_ONE_ID,
      }),
    ).toMatchObject({ok: true});
    expect(
      await ask(libraryEndpoints.search.channel, {query: ''}),
    ).toMatchObject({
      matches: [],
    });
    expect(
      await ask(contentEndpoints.edit.channel, {type: 'song.create'}),
    ).toMatchObject({ok: true});
    expect(
      await ask(libraryEndpoints.search.channel, {query: '새곡'}),
    ).toMatchObject({
      matches: [{title: '새 곡'}],
    });
    await store.dispose();
    expect(electron.handlers.has(libraryEndpoints.search.channel)).toBe(false);
  });

  it('refreshes background choices, missing-file warnings, and revisions on service reads', async () => {
    const context = await developmentContext();
    const root = join(context.appDataFolder, DATA_FOLDER_NAME);
    const mediaId = itemId(90);
    const video = join(root, 'Media', 'background.webm');
    await writeJson(video, 'video');
    await writeJson(join(root, 'Settings', 'media.json'), {
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
    await writeJson(join(root, 'Songs', 'song.llsong'), {
      ...hymnOne(),
      background: mediaId,
    });
    await writeJson(
      join(root, 'Services', 'open.llservice'),
      service(SUNDAY_ID, '2026-11-01T11:00', [
        {id: itemId(1), song: HYMN_ONE_ID},
      ]),
    );
    await register(mockLog(), context, () => true);

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
        ([channel]) => channel === serviceEndpoints.changed.channel,
      ),
    ).toHaveLength(2);
  });
});
