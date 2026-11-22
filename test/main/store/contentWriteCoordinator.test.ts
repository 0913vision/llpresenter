import {basename, join} from 'node:path';
import {describe, expect, it, vi} from 'vitest';
import {MAX_WAITING_SAVES} from '@main/store/saveFailures';
import {
  SONG,
  locations,
  setUp,
  songEdit,
  templateFile,
} from '@fixtures/main/store/contentStoreFixtures';

describe('ContentStore save failures', () => {
  it('names a waiting song by its title and reports it once written again', async () => {
    const {store, files, song} = setUp();
    files.failing = new Set([song.file]);
    await store.apply({
      type: 'song.update',
      song: {...song.data, title: 'Invented waiting hymn'},
      baseRevision: 1,
    });
    await vi.waitFor(() => expect(files.waiting).toHaveLength(1));
    expect(files.waiting.map(({file, name}) => [file, name])).toEqual([
      [song.file, 'Invented waiting hymn'],
    ]);
    files.failing = new Set();
    await files.waiting[0]?.retry();
    expect(files.saved).toEqual([song.file]);
  });

  it('admits an edit of a file that waits already at the cap', async () => {
    const {store, files} = setUp();
    files.failAll = true;
    await store.apply(songEdit(store, 'Invented waiting hymn', 1));
    await vi.waitFor(() => expect(files.waiting).toHaveLength(1));
    for (let index = 1; index < MAX_WAITING_SAVES; index++) {
      await store.apply({type: 'song.create'});
    }
    expect(await store.apply({type: 'song.create'})).toMatchObject({
      error: {reason: 'saves-full'},
    });
    expect(
      await store.apply(songEdit(store, 'Invented hymn again', 2)),
    ).toMatchObject({ok: true, value: {revision: 3}});
  });

  it('names a waiting 템플릿 without a name by its file name', async () => {
    const {store, files} = setUp();
    const template = templateFile();
    files.failing = new Set([template.file]);
    await store.apply({
      type: 'template.update',
      template: {...template.data, name: ''},
      baseRevision: 1,
    });
    await vi.waitFor(() =>
      expect(files.waiting.map(({name}) => name)).toEqual([
        basename(template.file),
      ]),
    );
  });

  it('names a waiting 템플릿 by its name', async () => {
    const {store, files} = setUp();
    const template = templateFile();
    files.failing = new Set([template.file]);
    await store.apply({
      type: 'template.update',
      template: {...template.data, name: 'Invented evening'},
      baseRevision: 1,
    });
    await vi.waitFor(() =>
      expect(files.waiting.map(({name}) => name)).toEqual(['Invented evening']),
    );
  });
});

describe('ContentStore persistence', () => {
  it('undoes a failed deletion by superseding its pending removal', async () => {
    const {store, files} = setUp();
    const file = join(locations.songs, 'hymn.llsong');
    files.failing = new Set([file]);
    expect(
      await store.apply({type: 'song.delete', songId: SONG}),
    ).toMatchObject({ok: false, error: {reason: 'write-failed'}});
    files.failing = new Set();
    expect(
      (await store.apply({type: 'content.undoDelete', area: 'song', id: SONG}))
        .ok,
    ).toBe(true);
    await store.flush();
    expect(store.song(SONG)).not.toBeNull();
    expect(files.removed).toEqual([file]);
    expect(files.texts.has(file)).toBe(true);
  });
  it('keeps failed deletions for a flush to retry', async () => {
    const {store, files} = setUp();
    files.failing = new Set([join(locations.songs, 'hymn.llsong')]);

    expect(
      await store.apply({type: 'song.delete', songId: SONG}),
    ).toMatchObject({
      ok: false,
      error: {reason: 'write-failed', applied: {id: SONG, revision: null}},
    });
    expect(store.song(SONG)).toBeNull();
    files.failing = new Set();
    await store.flush();
    expect(files.removed).toHaveLength(2);
  });

  it('debounces a typing burst and flushes the latest document before the delay', async () => {
    const {store, files} = setUp([], {writeDelayMs: 500});
    await store.apply(songEdit(store, '첫 제목', 1));
    await store.apply(songEdit(store, '마지막 제목', 2));

    expect(files.written).toEqual([]);
    await store.flush();

    expect(files.written).toHaveLength(1);
    expect(files.texts.get(join(locations.songs, 'hymn.llsong'))).toContain(
      '마지막 제목',
    );
  });

  it('keeps failed writes for a flush to retry, with the newest content', async () => {
    const {store, files} = setUp();
    files.failing = new Set([join(locations.songs, 'hymn.llsong')]);
    await store.apply(songEdit(store, '첫 제목', 1));
    await store.flush();
    await store.apply(songEdit(store, '최신 제목', 2));
    files.failing = new Set();

    await store.flush();

    expect(files.texts.get(join(locations.songs, 'hymn.llsong'))).toContain(
      '최신 제목',
    );
    const writes = files.written.length;
    await store.flush();
    expect(files.written).toHaveLength(writes);
  });

  it('returns write-failed after a rejected write and still accepts the next edit', async () => {
    const {store, files} = setUp();
    files.write = () => Promise.reject(new Error('device missing'));

    expect(await store.apply({type: 'song.create'})).toMatchObject({
      ok: false,
      error: {
        reason: 'write-failed',
        message: 'device missing',
        applied: {revision: 1},
      },
    });
    expect(await store.apply(songEdit(store, '다음 제목', 1))).toMatchObject({
      ok: true,
    });
  });

  it('does not recreate a deleted song from its pending autosave', async () => {
    const {store, files} = setUp([], {writeDelayMs: 500});
    await store.apply(songEdit(store, '지울 제목', 1));
    await store.apply({type: 'song.delete', songId: SONG});

    await store.flush();

    expect(files.written).toEqual([]);
    expect(store.song(SONG)).toBeNull();
  });
});
