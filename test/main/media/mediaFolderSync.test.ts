import {mkdir, rename, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {expect, it, vi} from 'vitest';
import {createMediaId, createMediaPlaylistId} from '@core/schema/common/ids';
import {parseMediaDocument} from '@core/schema/media/mediaEdit';
import {expectSuccess} from '@fixtures/core/schema/testHelpers';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {makeTempDir} from '@fixtures/tempDir';
import {MediaFolderSync, SETTLE_MS} from '@main/media/mediaFolderSync';
import {MediaStore} from '@main/store/media/mediaStore';

const VIDEO = createMediaId('00000000-0000-4000-8000-000000000001');
const IMAGE = createMediaId('00000000-0000-4000-8000-000000000002');
const LIST = createMediaPlaylistId('00000000-0000-4000-8000-000000000011');

async function setup({held = new Set<string>()} = {}) {
  const folder = await makeTempDir();
  await writeFile(join(folder, 'video.webm'), 'video');
  await writeFile(join(folder, 'image.png'), 'image');
  const log = recordingLogger();
  const store = new MediaStore({
    file: join(folder, 'media.json'),
    mediaFolder: folder,
    log,
    delayMs: 0,
    files: {
      write: () => Promise.resolve({ok: true, value: undefined}),
      remove: () => Promise.resolve({ok: true, value: undefined}),
    },
    held: {
      hold: () => Promise.resolve(),
      holds: file => held.has(file),
      restore: () => Promise.resolve(),
    },
    document: expectSuccess(
      parseMediaDocument({
        name: 'media',
        access: 'editable',
        revision: 1,
        value: {
          format: 'llmedia',
          schemaVersion: 1,
          items: [
            {
              id: VIDEO,
              name: '따뜻한 빛',
              kind: 'video',
              file: 'video.webm',
              size: 5,
              props: {end: 'loop'},
            },
            {
              id: IMAGE,
              name: '십자가',
              kind: 'image',
              file: 'image.png',
              size: 5,
            },
          ],
          playlists: [{id: LIST, name: '예배 전', items: [VIDEO, IMAGE]}],
          audioPlaylists: [],
        },
      }),
    ),
  });
  const adopt = vi.fn<(files: readonly string[]) => Promise<void>>(() =>
    Promise.resolve(),
  );
  const sync = new MediaFolderSync({
    store,
    adopt,
    log,
    now: () => Date.now() + SETTLE_MS * 2,
    watch: () => () => undefined,
  });
  return {folder, store, adopt, sync, log};
}

it('takes an item whose file left the folder out of the list, and brings it back as it was when the file returns (USER Nov 26)', async () => {
  const {folder, store, sync} = await setup();
  const before = store.get().value;
  await rename(join(folder, 'video.webm'), join(folder, '..', 'moved.webm'));
  await sync.sync();
  expect(store.get().value.items.map(item => item.id)).toEqual([IMAGE]);
  expect(store.get().value.playlists[0]?.items).toEqual([IMAGE]);

  await rename(join(folder, '..', 'moved.webm'), join(folder, 'video.webm'));
  await sync.sync();
  expect(store.get().value.items).toEqual(before.items);
  expect(store.get().value.playlists).toEqual(before.playlists);
  expect(store.get().value.removed).toBeUndefined();
});

it('puts a media file dropped in the folder into the list, and leaves hidden, other, half-written and importing files alone', async () => {
  const {folder, adopt, sync} = await setup();
  await writeFile(join(folder, '새 배경.jpg'), 'picture');
  await writeFile(join(folder, '.새 배경.jpg.tmp'), 'half');
  await writeFile(join(folder, '메모.txt'), 'notes');
  await writeFile(join(folder, '가져오는 중.mp4'), 'copying');
  await mkdir(join(folder, '.imports'));
  await writeFile(
    join(folder, '.imports', 'job.json'),
    JSON.stringify({version: 1, mediaId: VIDEO, file: '가져오는 중.mp4'}),
  );
  await sync.sync();
  await sync.sync();
  expect(adopt).toHaveBeenCalledExactlyOnceWith([join(folder, '새 배경.jpg')]);
});

it('waits for a file that just changed before it joins the list', async () => {
  const {folder, store, adopt, log} = await setup();
  await writeFile(join(folder, '새 배경.jpg'), 'picture');
  const sync = new MediaFolderSync({
    store,
    adopt,
    log,
    watch: () => () => undefined,
  });
  await sync.sync();
  expect(adopt).not.toHaveBeenCalled();
  await sync.dispose();
});

it('changes nothing when the folder can not be read', async () => {
  const {store, adopt, log} = await setup();
  const before = store.get();
  const sync = new MediaFolderSync({
    store: {
      folder: join(store.folder, 'gone'),
      get: () => store.get(),
      fileOf: id => store.fileOf(id),
      retire: ids => store.retire(ids),
      revive: id => store.revive(id),
      removedFiles: () => store.removedFiles(),
      holdsDeleted: file => store.holdsDeleted(file),
    },
    adopt,
    log,
    watch: () => () => undefined,
  });
  await sync.sync();
  expect(store.get()).toBe(before);
  expect(log.messages('warn')).toContain('could not read the media folder');
  await sync.dispose();
});

it('looks for a lost folder again, and brings the list to it when it is back', async () => {
  const {folder, store, adopt, log} = await setup();
  const lost: Array<(error: unknown) => void> = [];
  let missing = false;
  const watch = vi.fn(
    (_folder: string, _onChange: () => void, onLost: (e: unknown) => void) => {
      if (missing) throw new Error('ENOENT');
      lost.push(onLost);
      return () => undefined;
    },
  );
  const sync = new MediaFolderSync({
    store,
    adopt,
    log,
    now: () => Date.now() + SETTLE_MS * 2,
    watch,
    refollowMs: 5,
  });
  sync.start();
  await new Promise(resolve => setTimeout(resolve, 10));
  await sync.sync();

  missing = true;
  lost[0]?.(new Error('EPERM'));
  await rename(join(folder, 'video.webm'), join(folder, '..', 'moved.webm'));
  await vi.waitFor(() => expect(watch.mock.calls.length).toBeGreaterThan(3));
  expect(log.messages('warn')).toEqual(['lost the media folder']);
  expect(store.get().value.items).toHaveLength(2);

  missing = false;
  await vi.waitFor(() =>
    expect(store.get().value.items.map(item => item.id)).toEqual([IMAGE]),
  );
  expect(log.messages('info')).toContain('following the media folder again');
  await sync.dispose();
});

it('leaves the file of a deleted item that waits for the 휴지통 alone', async () => {
  const held = new Set<string>();
  const {folder, store, adopt, sync} = await setup({held});
  expect((await store.apply({type: 'media.delete', mediaId: IMAGE})).ok).toBe(
    true,
  );
  held.add(join(folder, 'image.png'));
  await sync.sync();
  expect(adopt).not.toHaveBeenCalled();
  expect(store.get().value.items.map(item => item.id)).toEqual([VIDEO]);
});
