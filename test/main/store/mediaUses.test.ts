import {
  ask,
  developmentContext,
  mockLog,
  register,
} from '@fixtures/main/store/registerFixtures';
import {mediaEndpoints} from '@contracts/ipc/media';
import {createMediaId} from '@core/schema/ids';
import {describe, expect, it} from 'vitest';
import {join} from 'node:path';
import {DATA_FOLDER_NAME} from '@main/store/locations';
import {
  HYMN_ONE_ID,
  hymnOne,
  itemId,
  service,
  SUNDAY_ID,
  writeJson,
} from '@fixtures/main/store/testFiles';

describe('media:uses through registerStore', () => {
  it('counts the places that hold a media item and rejects a malformed request', async () => {
    const context = await developmentContext();
    const root = join(context.appDataFolder, DATA_FOLDER_NAME);
    const mediaId = createMediaId(itemId(90));
    await writeJson(join(root, 'Settings', 'media.json'), {
      format: 'llmedia',
      schemaVersion: 1,
      items: [
        {
          id: mediaId,
          name: 'Background',
          kind: 'image',
          file: 'background.png',
          size: 5,
        },
      ],
      playlists: [{id: itemId(91), name: 'Images', items: [mediaId]}],
      audioPlaylists: [],
    });
    await writeJson(join(root, 'Songs', 'song.llsong'), {
      ...hymnOne(),
      background: mediaId,
    });
    await writeJson(
      join(root, 'Services', 'open.llservice'),
      service(SUNDAY_ID, '2026-11-01T11:00', [
        {id: itemId(1), song: HYMN_ONE_ID, background: mediaId},
        {id: itemId(2), media: mediaId},
      ]),
    );
    const store = await register(mockLog(), context, () => true);

    expect(await ask(mediaEndpoints.uses.channel, {mediaId})).toEqual({
      playlists: 1,
      graphics: 0,
      songBackgrounds: 1,
      serviceItems: 2,
      itemOverlays: 0,
      themes: 0,
      macros: 0,
    });
    await expect(
      ask(mediaEndpoints.uses.channel, {mediaId: 'x'}),
    ).rejects.toThrow('Invalid media uses request');
    await store.dispose();
  });
});
