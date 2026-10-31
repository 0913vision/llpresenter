import {parseGroupedSong} from '@core/schema/groupedSong';
import {createSongId} from '@core/schema/ids';
import {convertTextImport} from '@core/songs/textImport';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {ContentStore} from './contentStore';
import {HYMN_ONE_ID, SUNDAY_ID, hymnOne, itemId} from './testFiles';
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
} from './testing/contentStoreFixtures';

describe('song.import storage', () => {
  it('retains preview section identities through grouped persistence and reload', async () => {
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
    if (!preview.ok) {
      throw new Error(preview.error.message);
    }
    const result = await store.apply({
      type: 'song.import',
      target: {kind: 'new'},
      draft: preview.value,
    });
    if (!result.ok) {
      throw new Error(result.error.message);
    }
    const song = store.song(result.value.id)?.song;
    expect(song?.groups.map(group => group.name)).toEqual([
      'Verse',
      'Verse',
      'Chorus',
    ]);
    const text = files.texts.get(
      join(locations.songs, `${result.value.id}.llsong`),
    );
    if (text === undefined) {
      throw new Error('No persisted import');
    }
    const reopened = parseGroupedSong(text, 'invented.llsong');
    if (!reopened.ok) {
      throw new Error(reopened.error.message);
    }
    expect(reopened.value.data).toEqual(song);
    for (const group of reopened.value.data.groups) {
      expect(group.slides[0]).not.toHaveProperty('section');
    }
  });

  it('refuses missing overwrite targets and refuses new labels in a read-only list', async () => {
    const {store, files, settings} = importSetup(
      [],
      {},
      {access: 'readOnly', count: 1},
    );
    expect(
      await store.apply({
        type: 'song.import',
        draft: importedDraft,
        target: {
          kind: 'overwrite',
          songId: createSongId('00000000-0000-4000-8000-000000000002'),
          baseRevision: 1,
        },
      }),
    ).toMatchObject({ok: false, error: {reason: 'not-found'}});
    expect(
      await store.apply({
        type: 'song.import',
        draft: importedDraft,
        target: {kind: 'new'},
      }),
    ).toMatchObject({ok: false, error: {reason: 'read-only'}});
    expect(files.written).toHaveLength(0);
    expect(settings.get('labels').revision).toBe(1);
    expect(
      await store.apply({
        type: 'song.import',
        draft: {...importedDraft, slides: [{label: 'Existing 0', lines: []}]},
        target: {kind: 'new'},
      }),
    ).toMatchObject({ok: true});
    expect(files.written).toHaveLength(1);
    expect(settings.get('labels').revision).toBe(1);
  });
  it('refuses adding labels past the import cap before any document changes', async () => {
    const {store, files, settings} = importSetup([], {}, {count: 10_000});
    expect(
      await store.apply({
        type: 'song.import',
        draft: importedDraft,
        target: {kind: 'new'},
      }),
    ).toMatchObject({ok: false, error: {reason: 'invalid'}});
    expect(store.songList()).toHaveLength(1);
    expect(files.written).toHaveLength(0);
    expect(settings.get('labels').revision).toBe(1);
  });
  it('creates a new song, adds labels first, and rejects duplicate titles without changes', async () => {
    const {store, files, settings} = importSetup();
    const result = await store.apply({
      type: 'song.import',
      draft: importedDraft,
      target: {kind: 'new'},
    });
    if (!result.ok) throw new Error('Import failed');
    expect(result.value.id).not.toBe(SONG);
    expect(store.song(result.value.id)?.song).toMatchObject({
      title: importedDraft.title,
      schemaVersion: 2,
      groups: [{name: 'New label', slides: [{lines: ['Invented line']}]}],
    });
    expect(files.written[0]).toBe(join(locations.settings, 'labels.json'));
    expect(settings.get('labels').value).toMatchObject({
      future: 'kept',
      labels: [{name: 'New label', color: 'none', key: null}],
    });
    const writes = files.written.length;
    expect(
      await store.apply({
        type: 'song.import',
        draft: importedDraft,
        target: {kind: 'new'},
      }),
    ).toMatchObject({ok: false, error: {reason: 'duplicate-title'}});
    expect(files.written).toHaveLength(writes);
  });
  it('overwrites at the checked revision, preserves nested unknowns, and resets removed arrangement picks', async () => {
    const original = songFile({
      ...hymnOne(),
      future: 'song',
      slides: [{lines: ['Old'], future: 'slide'}],
      arrangements: [
        {name: 'Keep', slides: [1], future: 'arrangement'},
        {name: 'Drop', slides: [1]},
      ],
    });
    const picked = {
      id: itemId(1),
      song: HYMN_ONE_ID,
      arrangement: 'Drop',
      future: 'item',
    };
    const {store, files} = importSetup([serviceFile(SUNDAY_ID, [picked])], {
      songs: new Map([[HYMN_ONE_ID, original]]),
      templates: new Map([[TEMPLATE_ID, templateFile([picked])]]),
    });
    const draft = {
      ...importedDraft,
      arrangements: [{name: 'Keep', slides: [1]}],
    };
    expect(
      await store.apply({
        type: 'song.import',
        draft,
        target: {kind: 'overwrite', songId: SONG, baseRevision: 1},
      }),
    ).toEqual({ok: true, value: {id: SONG, revision: 2}});
    expect(store.song(SONG)?.song).toMatchObject({
      future: 'song',
      groups: [{slides: [{future: 'slide'}]}],
      arrangements: [{name: 'Keep', future: 'arrangement'}],
    });
    expect(store.song(SONG)?.song.groups[0]?.id).toBe(
      original.data.groups[0]?.id,
    );
    expect(store.song(SONG)?.song.arrangements?.[0]?.groups).toEqual([
      original.data.groups[0]?.id,
    ]);
    expect(store.service(SUNDAY)?.service.order[0]).toMatchObject({
      song: SONG,
      future: 'item',
    });
    expect(store.service(SUNDAY)?.service.order[0]).not.toHaveProperty(
      'arrangement',
    );
    expect(store.template(TEMPLATE)?.template.order[0]).not.toHaveProperty(
      'arrangement',
    );
    const before = files.written.length;
    expect(
      await store.apply({
        type: 'song.import',
        draft,
        target: {kind: 'overwrite', songId: SONG, baseRevision: 1},
      }),
    ).toMatchObject({ok: false, error: {reason: 'stale'}});
    expect(files.written).toHaveLength(before);
  });
  it('returns applied write failures and retries both labels and song through existing persistence', async () => {
    const {store, settings, files} = importSetup();
    files.failAll = true;
    const result = await store.apply({
      type: 'song.import',
      draft: importedDraft,
      target: {kind: 'new'},
    });
    if (result.ok || result.error.reason !== 'write-failed') {
      throw new Error('Expected applied failure');
    }
    expect(result.error.unchangedFiles).toHaveLength(2);
    expect(store.song(result.error.applied.id)?.song.title).toBe(
      importedDraft.title,
    );
    files.failAll = false;
    await settings.flush();
    await store.flush();
    expect(files.texts.size).toBe(2);
  });
  it('rejects read-only overwrites before creating labels or writing files', async () => {
    const original = songFile({...songFile().data, schemaVersion: 3});
    const {store, files, settings} = importSetup([], {
      songs: new Map([[HYMN_ONE_ID, original]]),
    });
    expect(
      await store.apply({
        type: 'song.import',
        draft: importedDraft,
        target: {kind: 'overwrite', songId: SONG, baseRevision: 1},
      }),
    ).toMatchObject({ok: false, error: {reason: 'read-only'}});
    expect(files.written).toHaveLength(0);
    expect(settings.get('labels').revision).toBe(1);
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
    const parsed = parseGroupedSong(text, song.file);
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
    const first = song.data.groups[0];
    if (first === undefined) throw new Error('Missing fixture group');
    const lyrics = {
      ...song.data,
      groups: [
        {
          ...first,
          slides: [
            {...first.slides[0], lines: ['새 가사']},
            ...first.slides.slice(1),
          ],
        },
        ...song.data.groups.slice(1),
      ],
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
      schemaVersion: 2,
      groups: [{name: '', slides: [{lines: []}]}],
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
