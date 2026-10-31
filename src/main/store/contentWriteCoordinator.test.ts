import {createSongId} from '@core/schema/ids';
import {basename, join} from 'node:path';
import {describe, expect, it, vi} from 'vitest';
import {MAX_WAITING_SAVES} from './saveFailures';
import {
  SONG,
  importedDraft,
  locations,
  setUp,
  songEdit,
  templateFile,
} from './testing/contentStoreFixtures';

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

  it('refuses new files once the cap of files wait, keeping each waiting delete', async () => {
    const {store, files, song} = setUp();
    files.failAll = true;
    for (let cycle = 0; cycle < MAX_WAITING_SAVES; cycle++) {
      const created = await store.apply({type: 'song.create'});
      if (created.ok || created.error.reason !== 'write-failed') {
        throw new Error('Expected a song kept in memory');
      }
      const deleted = await store.apply({
        type: 'song.delete',
        songId: createSongId(created.error.applied.id),
      });
      expect(deleted).toMatchObject({error: {reason: 'write-failed'}});
    }
    const waitingFiles = new Set(files.waiting.map(({file}) => file));
    expect(waitingFiles.size).toBe(MAX_WAITING_SAVES);
    const written = files.written.length;
    const removed = files.removed.length;

    const refusals = [
      await store.apply({type: 'song.create'}),
      await store.apply({
        type: 'song.import',
        draft: importedDraft,
        target: {kind: 'new'},
      }),
      await store.apply({type: 'song.delete', songId: song.data.id}),
      await store.apply(songEdit(store, 'Invented refused title', 1)),
    ];

    expect(refusals).toEqual(
      refusals.map(() => ({
        ok: false,
        error: {
          reason: 'saves-full',
          message: 'Too many files are waiting to be saved',
        },
      })),
    );
    expect(files.reminded).toBe(4);
    expect(store.song(song.data.id)?.revision).toBe(1);
    expect(store.songList().map(({id}) => id)).toEqual([song.data.id]);
    expect(files.written).toHaveLength(written);
    expect(files.removed).toHaveLength(removed);

    files.failAll = false;
    await Promise.all(files.waiting.map(save => save.retry()));
    expect(files.written).toHaveLength(written);
    expect(new Set(files.saved)).toEqual(waitingFiles);
    expect(await store.apply({type: 'song.create'})).toMatchObject({ok: true});
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

  it('keeps failed cross-file writes for a flush to retry, with the newest content', async () => {
    const {store, files} = setUp();
    files.failing = new Set([join(locations.songs, 'hymn.llsong')]);
    await store.apply({
      type: 'song.arrangement.rename',
      songId: SONG,
      from: '주일용',
      to: '짧게',
    });
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
