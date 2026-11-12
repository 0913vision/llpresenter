import {parseSong} from '@core/schema/song';
import {LIGHT_SONG_THEME_ID} from '@core/themes/lightSong';
import {createSongId} from '@core/schema/ids';
import {importSlides} from '@core/songs/importSlides';
import {convertTextImport} from '@core/songs/textImport';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {ContentStore} from '@main/store/contentStore';
import {
  HYMN_ONE_ID,
  SUNDAY_ID,
  hymnOne,
  itemId,
} from '@fixtures/main/store/testFiles';
import {
  SONG,
  SUNDAY,
  TEMPLATE,
  TEMPLATE_ID,
  importSetup,
  importedDraft,
  locations,
  mockEvents,
  mockFiles,
  quietLog,
  serviceFile,
  setUp,
  songEdit,
  songFile,
  templateFile,
} from '@fixtures/main/store/contentStoreFixtures';

describe('song.import storage', () => {
  it('persists the imported song theme', async () => {
    const {store, files} = importSetup();
    const result = await store.apply({
      type: 'song.import',
      target: {kind: 'new'},
      draft: {...importedDraft, theme: LIGHT_SONG_THEME_ID},
    });
    if (!result.ok) throw new Error(result.error.message);
    const text = files.texts.get(
      join(locations.songs, `${result.value.id}.llsong`),
    );
    if (!text) throw new Error('No persisted song');
    const parsed = parseSong(text, 'song.llsong');
    expect(parsed.ok && parsed.value.data.theme).toBe(LIGHT_SONG_THEME_ID);
  });

  it('keeps mapped header names on independent persisted slides', async () => {
    const {store, files} = importSetup();
    const preview = convertTextImport({
      source: {
        source: 'file',
        fileName: 'Invented.txt',
        text: '[Verse]\nInvented first\n[Verse]\nInvented second\n[Chorus]\nInvented third',
      },
      options: {
        split: 'lineBreak',
        unitsPerSlide: 1,
        labels: 'bracketLine',
        firstLine: 'lyrics',
      },
    });
    if (!preview.ok) throw new Error(preview.error.message);
    const result = await store.apply({
      type: 'song.import',
      target: {kind: 'new'},
      draft: {
        title: preview.value.title,
        slides: importSlides(preview.value.slides, () => crypto.randomUUID()),
      },
    });
    if (!result.ok) throw new Error(result.error.message);
    const song = store.song(result.value.id)?.song;
    expect(song?.slides.map(slide => slide.label)).toEqual([
      'Verse',
      'Verse',
      'Chorus',
    ]);
    const text = files.texts.get(
      join(locations.songs, `${result.value.id}.llsong`),
    );
    if (text === undefined) throw new Error('No persisted import');
    const reopened = parseSong(text, 'invented.llsong');
    if (!reopened.ok) throw new Error(reopened.error.message);
    expect(reopened.value.data).toEqual(song);
    expect(
      reopened.value.data.slides.every(
        slide => !Object.hasOwn(slide, 'section'),
      ),
    ).toBe(true);
  });
  it.each([{access: 'readOnly' as const, count: 1}, {count: 10_000}])(
    'keeps free labels out of the global catalog %j',
    async config => {
      const {store, files, settings} = importSetup([], {}, config);
      const labels = settings.get('labels');
      const result = await store.apply({
        type: 'song.import',
        draft: importedDraft,
        target: {kind: 'new'},
      });
      expect(result.ok).toBe(true);
      expect(settings.get('labels')).toEqual(labels);
      expect(files.written).toHaveLength(1);
    },
  );
  it('creates a new song and refuses duplicate titles without additional writes', async () => {
    const {store, files} = importSetup();
    const result = await store.apply({
      type: 'song.import',
      draft: importedDraft,
      target: {kind: 'new'},
    });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.id).not.toBe(SONG);
    expect(store.song(result.value.id)?.song).toMatchObject({
      title: importedDraft.title,
      slides: importedDraft.slides,
    });
    expect(
      await store.apply({
        type: 'song.import',
        draft: importedDraft,
        target: {kind: 'new'},
      }),
    ).toMatchObject({ok: false, error: {reason: 'duplicate-title'}});
    expect(files.written).toHaveLength(1);
  });
  it('overwrites the library at a checked revision without changing item decks', async () => {
    const original = songFile({...hymnOne(), future: 'song'});
    const picked = {
      id: itemId(1),
      song: HYMN_ONE_ID,
      slides: original.data.slides,
      future: 'item',
    };
    const {store, files} = importSetup([serviceFile(SUNDAY_ID, [picked])], {
      songs: new Map([[HYMN_ONE_ID, original]]),
      templates: new Map([[TEMPLATE_ID, templateFile([picked])]]),
    });
    const beforeService = store.service(SUNDAY);
    const beforeTemplate = store.template(TEMPLATE);
    expect(
      await store.apply({
        type: 'song.import',
        draft: importedDraft,
        target: {kind: 'overwrite', songId: SONG, baseRevision: 1},
      }),
    ).toEqual({ok: true, value: {id: SONG, revision: 2}});
    expect(store.song(SONG)?.song).toMatchObject({
      future: 'song',
      slides: importedDraft.slides,
    });
    expect(store.service(SUNDAY)).toEqual(beforeService);
    expect(store.template(TEMPLATE)).toEqual(beforeTemplate);
    expect(
      await store.apply({
        type: 'song.import',
        draft: importedDraft,
        target: {kind: 'overwrite', songId: SONG, baseRevision: 1},
      }),
    ).toMatchObject({ok: false, error: {reason: 'stale'}});
    expect(files.written).toHaveLength(1);
  });
  it('keeps an applied failed import and retries its song file', async () => {
    const {store, files} = importSetup();
    files.failAll = true;
    const result = await store.apply({
      type: 'song.import',
      draft: importedDraft,
      target: {kind: 'new'},
    });
    if (result.ok || result.error.reason !== 'write-failed') {
      throw new Error('Expected applied failure');
    }
    expect(result.error.unchangedFiles).toHaveLength(1);
    expect(store.song(result.error.applied.id)?.song.title).toBe(
      importedDraft.title,
    );
    files.failAll = false;
    await store.flush();
    expect(files.texts.size).toBe(1);
  });
  it('refuses missing and read-only overwrite targets before writing', async () => {
    const original = songFile({...songFile().data, schemaVersion: 2});
    const {store, files} = importSetup([], {
      songs: new Map([[HYMN_ONE_ID, original]]),
    });
    for (const [songId, reason] of [
      [SONG, 'read-only'],
      [createSongId('00000000-0000-4000-8000-000000000002'), 'not-found'],
    ] as const) {
      expect(
        await store.apply({
          type: 'song.import',
          draft: importedDraft,
          target: {kind: 'overwrite', songId, baseRevision: 1},
        }),
      ).toMatchObject({ok: false, error: {reason}});
    }
    expect(files.written).toHaveLength(0);
  });
});

describe('ContentStore song updates', () => {
  it('saves and pushes a trimmed NFC title without mutating the submitted song', async () => {
    const {store, files, events, song} = setUp();
    const title = '가온 연습';
    const submitted = {
      ...song.data,
      title: ` \t${title.normalize('NFD')}\u00a0\n`,
    };
    expect(
      await store.apply({
        type: 'song.update',
        song: submitted,
        baseRevision: 1,
      }),
    ).toMatchObject({ok: true});
    await store.flush();
    expect(submitted.title).not.toBe(title);
    expect(store.song(SONG)).toMatchObject({
      revision: 2,
      song: {title, copyright: 'public domain'},
    });
    expect(events.songChanged).toHaveBeenLastCalledWith({
      songId: SONG,
      document: store.song(SONG),
    });
    expect(events.songsListChanged).toHaveBeenLastCalledWith([
      expect.objectContaining({id: SONG, title}),
    ]);
    const text = files.texts.get(song.file);
    if (text === undefined) throw new Error('The changed song was not saved');
    const parsed = parseSong(text, song.file);
    if (!parsed.ok) throw new Error(parsed.error.message);
    expect(parsed.value.data.title).toBe(title);
  });

  it.each([
    {existing: '가온 연습', incoming: ' \t가온 연습\n'},
    {existing: '가온 연습'.normalize('NFD'), incoming: '가온 연습'},
    {
      existing: ` 가온 연습 `.normalize('NFD'),
      incoming: '\u00a0가온 연습\t'.normalize('NFD'),
    },
  ])(
    'refuses a normalized duplicate of a legacy title %# without changing either song',
    async ({existing, incoming}) => {
      const legacy = songFile({...hymnOne(), title: existing});
      const {store, files, events} = setUp([], {
        songs: new Map([[HYMN_ONE_ID, legacy]]),
      });
      const created = await store.apply({type: 'song.create'});
      if (!created.ok) throw new Error(created.error.message);
      const other = store.song(created.value.id);
      if (other === null) throw new Error('The new song is missing');
      const written = files.written.length;
      events.songChanged.mockClear();
      events.songsListChanged.mockClear();
      const result = await store.apply({
        type: 'song.update',
        song: {...other.song, title: incoming},
        baseRevision: other.revision,
      });
      await store.flush();
      expect(result).toMatchObject({
        ok: false,
        error: {reason: 'duplicate-title'},
      });
      expect(store.song(created.value.id)).toEqual(other);
      expect(store.song(SONG)?.song.title).toBe(existing);
      expect(files.written).toHaveLength(written);
      expect(events.songChanged).not.toHaveBeenCalled();
      expect(events.songsListChanged).not.toHaveBeenCalled();
    },
  );

  it('accepts an equivalent title for the same song without pushing a changed library row', async () => {
    const {store, song, events} = setUp();
    expect(
      await store.apply({
        type: 'song.update',
        song: {...song.data, title: '가온 연습'},
        baseRevision: 1,
      }),
    ).toMatchObject({ok: true});
    events.songsListChanged.mockClear();
    expect(
      await store.apply({
        type: 'song.update',
        song: {...song.data, title: ' 가온 연습 '.normalize('NFD')},
        baseRevision: 2,
      }),
    ).toMatchObject({ok: true});
    expect(store.song(SONG)).toMatchObject({
      revision: 3,
      song: {title: '가온 연습'},
    });
    expect(events.songsListChanged).not.toHaveBeenCalled();
  });

  it('refuses a title that becomes blank before changing revision or scheduling a save', async () => {
    const {store, song, files, events} = setUp();
    expect(
      await store.apply({
        type: 'song.update',
        song: {...song.data, title: ' \t\u00a0\n'},
        baseRevision: 1,
      }),
    ).toMatchObject({ok: false, error: {reason: 'invalid'}});
    await store.flush();
    expect(store.song(SONG)?.revision).toBe(1);
    expect(files.written).toEqual([]);
    expect(events.songChanged).not.toHaveBeenCalled();
  });

  it('applies an update over the stored song, so unknown fields survive', async () => {
    const {store, files, events} = setUp();
    const edited = songFile({...hymnOne(), title: '새 제목'}).data;

    const answer = await store.apply({
      type: 'song.update',
      song: edited,
      baseRevision: 1,
    });
    await store.flush();

    expect(answer).toEqual({ok: true, value: {id: SONG, revision: 2}});
    expect(store.song(SONG)?.song).toMatchObject({
      title: '새 제목',
      copyright: 'public domain',
    });
    expect(files.texts.get(join(locations.songs, 'hymn.llsong'))).toContain(
      '"copyright": "public domain"',
    );
    expect(events.songChanged).toHaveBeenLastCalledWith({
      songId: SONG,
      document: store.song(SONG),
    });
  });

  it('answers stale for an update from an older revision, and changes nothing', async () => {
    const {store} = setUp();
    await store.apply(songEdit(store, '첫 고침', 1));

    const answer = await store.apply(songEdit(store, '늦은 고침', 1));

    expect(answer).toMatchObject({ok: false, error: {reason: 'stale'}});
    expect(store.song(SONG)).toMatchObject({
      revision: 2,
      song: {title: '첫 고침'},
    });
  });

  it('pushes the list only when what it shows changes', async () => {
    const {store, events, song} = setUp();
    const lyrics = {
      ...song.data,
      slides: song.data.slides.map((slide, index) =>
        index === 0 ? {...slide, lines: ['Invented revised line']} : slide,
      ),
    };
    await store.apply({type: 'song.update', song: lyrics, baseRevision: 1});
    expect(events.songsListChanged).not.toHaveBeenCalled();
    await store.apply(songEdit(store, '새 제목', 2));

    expect(events.songsListChanged).toHaveBeenCalledTimes(1);
    expect(events.songChanged).toHaveBeenCalledTimes(2);
  });

  it('refuses a title another song has, and a song a newer version wrote', async () => {
    const {store} = setUp();
    await store.apply({type: 'song.create'});
    const created = store.songList().find(({title}) => title === '새 곡');
    const other = store.song(created?.id ?? '');

    const duplicate = await store.apply({
      type: 'song.update',
      song: {...(other?.song ?? songFile().data), title: '만복의 근원 하나님'},
      baseRevision: 1,
    });

    expect(duplicate).toMatchObject({
      ok: false,
      error: {reason: 'duplicate-title'},
    });

    const newer = new ContentStore({
      locations,
      songs: new Map([
        [HYMN_ONE_ID, songFile({...songFile().data, schemaVersion: 99})],
      ]),
      services: new Map(),
      templates: new Map(),
      files: mockFiles(),
      events: mockEvents(),
      log: quietLog(),
    });
    expect(await newer.apply(songEdit(newer, '고침', 1))).toMatchObject({
      ok: false,
      error: {reason: 'read-only'},
    });
  });
});

describe('ContentStore song.saveAs', () => {
  it('creates a new song with a new id from the whole document and leaves the original', async () => {
    const {store, files, song} = setUp();
    const original = store.song(SONG);

    const result = await store.apply({
      type: 'song.saveAs',
      song: {...song.data, title: '만복의 근원 2'},
    });

    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.id).not.toBe(SONG);
    const saved = store.song(result.value.id);
    expect(saved?.song).toMatchObject({
      id: result.value.id,
      title: '만복의 근원 2',
      slides: song.data.slides,
    });
    expect(store.song(SONG)).toEqual(original);
    expect(files.written).toContain(
      join(locations.songs, `${result.value.id}.llsong`),
    );
  });

  it('refuses a title another song has and a blank title, and adds nothing', async () => {
    const {store, song} = setUp();
    const count = store.songList().length;

    const duplicate = await store.apply({type: 'song.saveAs', song: song.data});
    const blank = await store.apply({
      type: 'song.saveAs',
      song: {...song.data, title: '  '},
    });

    expect(duplicate).toMatchObject({
      ok: false,
      error: {reason: 'duplicate-title'},
    });
    expect(blank).toMatchObject({ok: false, error: {reason: 'invalid'}});
    expect(store.songList()).toHaveLength(count);
  });
});

describe('ContentStore song creation and deletion', () => {
  it('skips padded and decomposed legacy default titles when naming a new song', async () => {
    const one = songFile({...hymnOne(), title: ' 새 곡 '.normalize('NFD')});
    const two = {
      ...songFile({
        ...hymnOne(),
        id: TEMPLATE_ID,
        title: '\t새 곡 2\u00a0'.normalize('NFD'),
      }),
      file: join(locations.songs, 'second.llsong'),
    };
    const {store, files} = setUp([], {
      songs: new Map([
        [one.data.id, one],
        [two.data.id, two],
      ]),
    });
    const created = await store.apply({type: 'song.create'});
    if (!created.ok) throw new Error(created.error.message);
    expect(store.song(created.value.id)?.song.title).toBe('새 곡 3');
    expect(store.song(SONG)?.song.title).toBe(one.data.title);
    expect(files.written).toHaveLength(1);
    const text = [...files.texts.values()][0];
    if (text === undefined) throw new Error('The created song was not saved');
    expect(JSON.parse(text)).toHaveProperty('title', '새 곡 3');
  });

  it('creates 새 곡, then 새 곡 2, each with one blank 장', async () => {
    const {store, files} = setUp();

    const first = await store.apply({type: 'song.create'});
    const second = await store.apply({type: 'song.create'});

    const titles = store.songList().map(({title}) => title);
    expect(titles).toEqual(['만복의 근원 하나님', '새 곡', '새 곡 2']);
    expect(first.ok && second.ok).toBe(true);
    const id = first.ok ? first.value.id : '';
    expect(store.song(id)?.song).toMatchObject({
      schemaVersion: 1,
      slides: [
        {titleSlide: true, lines: [store.song(id)?.song.title]},
        {lines: []},
      ],
    });
    expect(files.written).toEqual([
      join(locations.songs, `${id}.llsong`),
      expect.stringMatching(/\.llsong$/),
    ]);
  });

  it('keeps a created song when its file fails, and says which song it was', async () => {
    const {store, files} = setUp();
    files.failing = new Set(['*']);
    const write = files.write;
    files.write = request => {
      files.failing = new Set([request.target.file]);
      return write(request);
    };

    const answer = await store.apply({type: 'song.create'});

    expect(answer).toMatchObject({
      ok: false,
      error: {reason: 'write-failed', applied: {revision: 1}},
    });
    const id = answer.ok
      ? ''
      : 'applied' in answer.error
        ? answer.error.applied.id
        : '';
    expect(store.song(id)?.song.title).toBe('새 곡');
  });

  it('deletes a song and pushes that it is gone', async () => {
    const {store, files, events} = setUp();

    const answer = await store.apply({type: 'song.delete', songId: SONG});

    expect(answer).toEqual({ok: true, value: {id: SONG, revision: null}});
    expect(store.song(SONG)).toBeNull();
    expect(files.removed).toEqual([join(locations.songs, 'hymn.llsong')]);
    expect(events.songChanged).toHaveBeenLastCalledWith({
      songId: SONG,
      document: null,
    });
  });
});
