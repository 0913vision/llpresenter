import {resolve} from 'node:path';
import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {
  createMediaId,
  createMediaPlaylistId,
  createAudioPlaylistId,
} from '@shared/schema/ids';
import {
  parseMediaDocument,
  type MediaEditResult,
} from '@shared/schema/mediaEdit';
import {MEDIA_LIMITS} from '@shared/schema/mediaList';
import {expectSuccess} from '@shared/schema/testHelpers';
import {recordingLogger} from '../displays/testing';
import type {DocumentFiles} from './contentPersistence';
import {MediaStore} from './mediaStore';
import type {MediaListEdit} from './mediaEdits';

const uuid = (index: number) =>
  `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
const VIDEO = createMediaId(uuid(1));
const AUDIO = createMediaId(uuid(2));
const IMAGE = createMediaId(uuid(3));
const NEW = createMediaId(uuid(4));
const LIST = createMediaPlaylistId(uuid(11));
const AUDIO_LIST = createAudioPlaylistId(uuid(12));
const FILE = resolve('/data/settings/media.json');
const FOLDER = resolve('/data/media');

function setup(access: 'editable' | 'readOnly' = 'editable') {
  vi.useFakeTimers();
  const write = vi
    .fn<DocumentFiles['write']>()
    .mockResolvedValue({ok: true, value: undefined});
  const remove = vi
    .fn<DocumentFiles['remove']>()
    .mockResolvedValue({ok: true, value: undefined});
  const log = recordingLogger();
  const store = new MediaStore({
    file: FILE,
    mediaFolder: FOLDER,
    developmentFolder: resolve('/data'),
    log,
    files: {write, remove},
    document: expectSuccess(
      parseMediaDocument({
        name: 'media',
        access,
        revision: 1,
        value: {
          format: 'llmedia',
          schemaVersion: 1,
          future: 'root',
          items: [
            {
              id: VIDEO,
              name: 'Invented video',
              kind: 'video',
              file: 'video.webm',
              size: 20,
              duration: 60,
              future: 'item',
              props: {in: 0, out: 30, end: 'loop', volume: 80, future: 'props'},
            },
            {
              id: AUDIO,
              name: 'Invented audio',
              kind: 'audio',
              file: 'audio.mp3',
              size: 10,
              duration: 100,
            },
            {
              id: IMAGE,
              name: 'Invented image',
              kind: 'image',
              file: 'image.png',
              size: 5,
            },
          ],
          playlists: [
            {
              id: LIST,
              name: 'Visuals',
              items: [VIDEO, IMAGE],
              future: 'playlist',
            },
          ],
          audioPlaylists: [
            {id: AUDIO_LIST, name: 'Audio', items: [AUDIO], loop: false},
          ],
        },
      }),
    ),
  });
  onTestFinished(async () => {
    await store.dispose();
    vi.useRealTimers();
  });
  return {store, write, remove, log};
}

async function saved(result: Promise<MediaEditResult>) {
  await vi.advanceTimersByTimeAsync(500);
  return result;
}

async function apply(store: MediaStore, edit: MediaListEdit) {
  return saved(store.apply(edit));
}

describe('media list edits and saves', () => {
  it('pushes revisions before disk I/O, debounces edits, preserves unknown fields, and rejects stale revisions', async () => {
    const {store, write} = setup();
    const listener = vi.fn();
    const stop = store.subscribe(listener);
    const first = store.apply({
      type: 'media.properties.update',
      mediaId: VIDEO,
      baseRevision: 1,
      changes: {name: 'Renamed video'},
    });
    expect(store.get().revision).toBe(2);
    expect(listener).toHaveBeenCalledOnce();
    expect(write).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(400);
    const second = store.apply({
      type: 'media.properties.update',
      mediaId: VIDEO,
      baseRevision: 2,
      changes: {props: {end: 'stop', volume: 40}},
    });
    expect(
      await store.apply({
        type: 'media.properties.update',
        mediaId: VIDEO,
        baseRevision: 1,
        changes: {name: 'Stale'},
      }),
    ).toMatchObject({ok: false, error: {reason: 'stale'}});
    await vi.advanceTimersByTimeAsync(499);
    expect(write).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(await first).toMatchObject({ok: true, value: {revision: 2}});
    expect(await second).toMatchObject({ok: true, value: {revision: 3}});
    expect(write).toHaveBeenCalledOnce();
    const text: unknown = JSON.parse(write.mock.calls[0]?.[0].text ?? '');
    expect(text).toHaveProperty('future', 'root');
    expect(text).toHaveProperty('items.0.future', 'item');
    expect(text).toHaveProperty('items.0.name', 'Renamed video');
    expect(text).toHaveProperty('items.0.props.future', 'props');
    expect(text).not.toHaveProperty('items.0.props.out');
    expect(store.fileOf(VIDEO)).toBe(resolve(FOLDER, 'video.webm'));
    stop();
  });

  it('creates, renames, reorders and deletes playlists without deleting library items', async () => {
    const {store, remove} = setup();
    const created = await apply(store, {
      type: 'media.playlist.create',
      kind: 'media',
    });
    if (!created.ok || created.value === null) {
      throw new Error('Playlist not created');
    }
    const playlist = store
      .get()
      .value.playlists.find(item => item.id === created.value?.id);
    if (playlist === undefined) throw new Error('Missing created playlist');
    expect(playlist.name).toBe('새 재생목록');
    expect(
      (
        await apply(store, {
          type: 'media.playlist.update',
          playlist: {
            kind: 'media',
            value: {...playlist, name: 'Ordered', items: [IMAGE, VIDEO]},
          },
          baseRevision: 2,
        })
      ).ok,
    ).toBe(true);
    expect(store.get().value.playlists.at(-1)).toMatchObject({
      name: 'Ordered',
      items: [IMAGE, VIDEO],
    });
    const audio = await apply(store, {
      type: 'media.playlist.create',
      kind: 'audio',
    });
    expect(audio.ok).toBe(true);
    expect(store.get().value.audioPlaylists.at(-1)).toMatchObject({
      name: '새 재생목록',
      loop: false,
      items: [],
    });
    expect(
      (
        await apply(store, {
          type: 'media.playlist.delete',
          playlist: {kind: 'media', id: playlist.id},
        })
      ).ok,
    ).toBe(true);
    expect(store.get().value.items).toHaveLength(3);
    expect(remove).not.toHaveBeenCalled();
  });

  it('rejects unknown playlist members, non-audio tracks and invalid duration-relative ranges before mutation', async () => {
    const {store, write} = setup();
    const original = store.get();
    for (const edit of [
      {
        type: 'media.playlist.update',
        baseRevision: 1,
        playlist: {
          kind: 'media',
          value: {id: LIST, name: 'Bad member', items: [NEW]},
        },
      },
      {
        type: 'media.playlist.update',
        baseRevision: 1,
        playlist: {
          kind: 'audio',
          value: {
            id: AUDIO_LIST,
            name: 'Bad audio',
            items: [VIDEO],
            loop: false,
          },
        },
      },
      {
        type: 'media.properties.update',
        baseRevision: 1,
        mediaId: VIDEO,
        changes: {props: {in: 61}},
      },
      {
        type: 'media.properties.update',
        baseRevision: 1,
        mediaId: VIDEO,
        changes: {props: {out: 61}},
      },
    ] satisfies readonly MediaListEdit[]) {
      expect(await store.apply(edit)).toMatchObject({
        ok: false,
        error: {reason: 'invalid'},
      });
    }
    expect(store.get()).toBe(original);
    expect(write).not.toHaveBeenCalled();
  });

  it('removes deleted IDs from all playlists and lookup without deleting media files', async () => {
    const {store, remove} = setup();
    const first = store.apply({type: 'media.delete', mediaId: VIDEO});
    const second = store.apply({type: 'media.delete', mediaId: AUDIO});
    await vi.advanceTimersByTimeAsync(500);
    expect((await first).ok).toBe(true);
    expect((await second).ok).toBe(true);
    expect(store.fileOf(VIDEO)).toBeNull();
    expect(store.fileOf(AUDIO)).toBeNull();
    expect(store.get().value.playlists[0]?.items).toEqual([IMAGE]);
    expect(store.get().value.audioPlaylists[0]?.items).toEqual([]);
    expect(remove).not.toHaveBeenCalled();
  });

  it('keeps applied state and returns failed files, then retries the newest content', async () => {
    const {store, write} = setup();
    write.mockResolvedValueOnce({
      ok: false,
      error: {file: FILE, message: 'Disk unavailable'},
    });
    const result = await apply(store, {
      type: 'media.properties.update',
      mediaId: IMAGE,
      baseRevision: 1,
      changes: {name: 'Kept edit'},
    });
    expect(result).toEqual({
      ok: false,
      error: {
        reason: 'write-failed',
        message: 'Disk unavailable',
        applied: {id: IMAGE, revision: 2},
        unchangedFiles: [FILE],
      },
    });
    expect(store.get().revision).toBe(2);
    await store.flush();
    expect(write).toHaveBeenCalledTimes(2);
    expect(write.mock.calls[1]?.[0].text).toContain('Kept edit');
  });

  it('refuses read-only edits and closes by flushing accepted edits and dropping subscriptions', async () => {
    const locked = setup('readOnly');
    expect(
      await locked.store.apply({type: 'media.delete', mediaId: VIDEO}),
    ).toMatchObject({ok: false, error: {reason: 'read-only'}});
    expect(locked.write).not.toHaveBeenCalled();
    const {store, write, log} = setup();
    store.subscribe(() => {
      throw new Error('Listener failed');
    });
    const listener = vi.fn();
    store.subscribe(listener);
    const pending = store.apply({
      type: 'media.properties.update',
      mediaId: IMAGE,
      changes: {name: 'Saved on close'},
      baseRevision: 1,
    });
    expect(listener).toHaveBeenCalledOnce();
    expect(log.messages('error')).toContain('media change listener failed');
    await store.dispose();
    expect((await pending).ok).toBe(true);
    expect(write).toHaveBeenCalledOnce();
    expect(
      await store.apply({type: 'media.delete', mediaId: IMAGE}),
    ).toMatchObject({ok: false, error: {reason: 'not-found'}});
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('P6a catalog completion port', () => {
  it('adds analysed media into a playlist and replaces its path against the current revision', async () => {
    const {store} = setup();
    const item = {
      id: NEW,
      name: 'Imported invented image',
      kind: 'image',
      file: 'imported.png',
      size: 20,
    } as const;
    expect(
      (
        await saved(
          store.add(
            {baseRevision: 1, items: [item]},
            {kind: 'media', id: LIST},
          ),
        )
      ).ok,
    ).toBe(true);
    expect(store.get().value.playlists[0]?.items).toEqual([VIDEO, IMAGE, NEW]);
    expect(store.fileOf(NEW)).toBe(resolve(FOLDER, 'imported.png'));
    expect(
      (
        await saved(
          store.replace({
            baseRevision: 2,
            items: [{...item, file: 'relinked.png', size: 30}],
          }),
        )
      ).ok,
    ).toBe(true);
    expect(store.fileOf(NEW)).toBe(resolve(FOLDER, 'relinked.png'));
    expect(await store.replace({baseRevision: 1, items: [item]})).toMatchObject(
      {ok: false, error: {reason: 'stale'}},
    );
    expect(store.get().value).toHaveProperty('playlists.0.future', 'playlist');
  });

  it('rejects invalid analysis, unsafe paths, duplicate IDs and audio-reference kind changes', async () => {
    const {store, write} = setup();
    const invalid = await store.add(
      {
        baseRevision: 1,
        items: [
          {
            id: NEW,
            name: 'Bad metadata',
            kind: 'image',
            file: 'bad.png',
            size: -1,
          },
        ],
      },
      null,
    );
    expect(invalid).toMatchObject({ok: false, error: {reason: 'invalid'}});
    expect(
      await store.add(
        {
          baseRevision: 1,
          items: [
            {
              id: NEW,
              name: 'Escape',
              kind: 'image',
              file: '../outside.png',
              size: 1,
            },
          ],
        },
        null,
      ),
    ).toMatchObject({ok: false, error: {reason: 'invalid'}});
    const audio = store.get().value.items.find(item => item.id === AUDIO);
    if (audio === undefined) throw new Error('Missing fixture audio');
    expect(
      await store.replace({
        baseRevision: 1,
        items: [{...audio, kind: 'image'}],
      }),
    ).toMatchObject({ok: false, error: {reason: 'invalid'}});
    expect(
      await store.add({baseRevision: 1, items: [audio]}, null),
    ).toMatchObject({ok: false, error: {reason: 'invalid'}});
    expect(
      await store.replace({baseRevision: NaN, items: [audio]}),
    ).toMatchObject({ok: false, error: {reason: 'invalid'}});
    expect(
      await store.add(
        {
          baseRevision: 1,
          items: Array.from(
            {length: MEDIA_LIMITS.importBatch + 1},
            () => audio,
          ),
        },
        null,
      ),
    ).toMatchObject({ok: false, error: {reason: 'invalid'}});
    expect(store.get().revision).toBe(1);
    expect(write).not.toHaveBeenCalled();
  });
});
