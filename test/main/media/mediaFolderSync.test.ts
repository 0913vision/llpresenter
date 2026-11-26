import {mkdir, rename, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {expect, it, vi} from 'vitest';
import {
  createMediaId,
  createMediaPlaylistId,
  type MediaId,
} from '@core/schema/common/ids';
import {
  parseMediaDocument,
  type MediaEditResult,
} from '@core/schema/media/mediaEdit';
import {expectSuccess} from '@fixtures/core/schema/testHelpers';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {makeTempDir} from '@fixtures/tempDir';
import {
  MediaFolderSync,
  SETTLE_MS,
  type FolderSyncStore,
} from '@main/media/mediaFolderSync';

const VIDEO = createMediaId('00000000-0000-4000-8000-000000000001');
const IMAGE = createMediaId('00000000-0000-4000-8000-000000000002');
const LIST = createMediaPlaylistId('00000000-0000-4000-8000-000000000011');
const FILES = new Map<string, string>([
  [VIDEO, 'video.webm'],
  [IMAGE, 'image.png'],
]);

const DOCUMENT = expectSuccess(
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
        },
        {id: IMAGE, name: '십자가', kind: 'image', file: 'image.png', size: 5},
      ],
      playlists: [{id: LIST, name: '예배 전', items: [VIDEO, IMAGE]}],
      audioPlaylists: [],
    },
  }),
);

/**
 * A media store mock: items leave the list as records and come back by them,
 * as the store does (its own tests hold how it keeps an item as it was).
 */
function mockStore(
  folder: string,
  {
    held = new Set<string>(),
    listed = [VIDEO, IMAGE],
  }: {held?: ReadonlySet<string>; listed?: readonly MediaId[]} = {},
) {
  const shown = new Set<string>(listed);
  const records = new Map<string, MediaId>();
  const fileOf = (id: string): string => join(folder, FILES.get(id) ?? '');
  const done = (): Promise<MediaEditResult> =>
    Promise.resolve({ok: true, value: null});
  return {
    folder,
    get: () => ({
      ...DOCUMENT,
      value: {
        ...DOCUMENT.value,
        items: DOCUMENT.value.items.filter(item => shown.has(item.id)),
      },
    }),
    fileOf: (id: string) => (shown.has(id) ? fileOf(id) : null),
    retire: vi.fn((ids: readonly MediaId[]) => {
      for (const id of ids) {
        shown.delete(id);
        records.set(fileOf(id), id);
      }
      return done();
    }),
    revive: vi.fn((ids: readonly MediaId[]) => {
      const back = ids.filter(id => records.delete(fileOf(id)));
      if (back.length === 0) return null;
      for (const id of back) shown.add(id);
      return done();
    }),
    removedFiles: () => records,
    holdsDeleted: (file: string) => held.has(file),
    /** Lists an item as an import does once its file is analysed. */
    list: (id: MediaId) => shown.add(id),
  } satisfies FolderSyncStore & {list: (id: MediaId) => unknown};
}

async function setup(options?: Parameters<typeof mockStore>[1]) {
  const folder = await makeTempDir();
  await writeFile(join(folder, 'video.webm'), 'video');
  await writeFile(join(folder, 'image.png'), 'image');
  const log = recordingLogger();
  const store = mockStore(folder, options);
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

function listedIds(store: ReturnType<typeof mockStore>): string[] {
  return store.get().value.items.map(item => item.id);
}

it('takes an item whose file left the folder out of the list, and brings it back by its record when the file returns (USER Nov 26)', async () => {
  const {folder, store, sync} = await setup();
  const away = await makeTempDir();
  await rename(join(folder, 'video.webm'), join(away, 'video.webm'));
  await sync.sync();
  expect(store.retire).toHaveBeenCalledExactlyOnceWith([VIDEO]);
  expect(listedIds(store)).toEqual([IMAGE]);

  await rename(join(away, 'video.webm'), join(folder, 'video.webm'));
  await sync.sync();
  expect(store.revive).toHaveBeenCalledExactlyOnceWith([VIDEO]);
  expect(listedIds(store)).toEqual([VIDEO, IMAGE]);
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
  const {folder, adopt, log} = await setup();
  const store = mockStore(join(folder, 'gone'));
  const sync = new MediaFolderSync({
    store,
    adopt,
    log,
    watch: () => () => undefined,
  });
  await sync.sync();
  expect(store.retire).not.toHaveBeenCalled();
  expect(adopt).not.toHaveBeenCalled();
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
  const away = await makeTempDir();
  await rename(join(folder, 'video.webm'), join(away, 'video.webm'));
  await vi.waitFor(() => expect(watch.mock.calls.length).toBeGreaterThan(3));
  expect(log.messages('warn')).toEqual(['lost the media folder']);
  expect(store.retire).not.toHaveBeenCalled();

  missing = false;
  await vi.waitFor(() => expect(listedIds(store)).toEqual([IMAGE]));
  expect(log.messages('info')).toContain('following the media folder again');
  await sync.dispose();
});

it('leaves the file of a deleted item that waits for the 휴지통 alone', async () => {
  const held = new Set<string>();
  const {folder, store, adopt, sync} = await setup({held, listed: [VIDEO]});
  held.add(join(folder, 'image.png'));
  await sync.sync();
  expect(adopt).not.toHaveBeenCalled();
  expect(store.revive).not.toHaveBeenCalled();
  expect(listedIds(store)).toEqual([VIDEO]);
});

it('follows a new folder made where the heard one was, as Windows tells a watch nothing when its folder moves away', async () => {
  const {store, adopt, log} = await setup();
  let identity = 'first';
  const watch = vi.fn(() => () => undefined);
  const sync = new MediaFolderSync({
    store,
    adopt,
    log,
    now: () => Date.now() + SETTLE_MS * 2,
    watch,
    refollowMs: 5,
    checkMs: 5,
    identify: () => Promise.resolve(identity),
  });
  sync.start();
  await new Promise(resolve => setTimeout(resolve, 20));
  expect(watch).toHaveBeenCalledTimes(1);

  identity = 'second';
  await vi.waitFor(() => expect(watch).toHaveBeenCalledTimes(2));
  expect(log.messages('warn')).toEqual([
    'the media folder went away or was replaced',
  ]);
  await vi.waitFor(() =>
    expect(log.messages('info')).toContain('following the media folder again'),
  );
  await sync.dispose();
});

it('brings items back newest first, so items that left one after another come back in their order', async () => {
  const {folder, store, sync} = await setup();
  const away = await makeTempDir();
  for (const name of ['image.png', 'video.webm']) {
    await rename(join(folder, name), join(away, name));
    await sync.sync();
  }
  expect(store.retire.mock.calls).toEqual([[[IMAGE]], [[VIDEO]]]);
  for (const name of ['image.png', 'video.webm']) {
    await rename(join(away, name), join(folder, name));
  }
  await sync.sync();
  expect(store.revive.mock.calls).toEqual([[[VIDEO, IMAGE]]]);
});

it('brings back a file that was just put into the list, left and came back, without waiting for the import to time out', async () => {
  const {folder, store, adopt, sync} = await setup({listed: [IMAGE]});
  await sync.sync();
  expect(adopt).toHaveBeenCalledExactlyOnceWith([join(folder, 'video.webm')]);
  store.list(VIDEO);
  const away = await makeTempDir();
  await rename(join(folder, 'video.webm'), join(away, 'video.webm'));
  await sync.sync();
  expect(store.retire).toHaveBeenCalledExactlyOnceWith([VIDEO]);
  await rename(join(away, 'video.webm'), join(folder, 'video.webm'));
  await sync.sync();
  expect(store.revive).toHaveBeenCalledExactlyOnceWith([VIDEO]);
});

it('reads the folder again at once on 새로 고침, hearing it anew', async () => {
  const {folder, store, adopt, log} = await setup();
  const watch = vi.fn(() => () => undefined);
  const sync = new MediaFolderSync({
    store,
    adopt,
    log,
    now: () => Date.now() + SETTLE_MS * 2,
    watch,
  });
  sync.start();
  await new Promise(resolve => setTimeout(resolve, 10));
  await writeFile(join(folder, '새 배경.jpg'), 'picture');
  await sync.refresh();
  expect(watch).toHaveBeenCalledTimes(2);
  expect(adopt).toHaveBeenCalledWith([join(folder, '새 배경.jpg')]);
  await sync.dispose();
});
