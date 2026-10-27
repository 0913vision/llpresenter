import {basename, join, resolve} from 'node:path';
import {describe, expect, it, onTestFinished, vi} from 'vitest';
import type {Result} from '@shared/result';
import type {ContentEdit} from '@shared/schema/contentEdit';
import {parseSettingsDocument} from '@shared/schema/settingsDocuments';
import type {FileError, LoadedFile} from '@shared/schema/fileFormat';
import {
  createSongId,
  serviceIdSchema,
  serviceItemIdSchema,
  songIdSchema,
  templateIdSchema,
} from '@shared/schema/ids';
import {parseService, parseTemplate} from '@shared/schema/service';
import {parseGroupedSong} from '@shared/schema/groupedSong';
import {testId} from '@shared/schema/testHelpers';
import type {Logger} from '../log';
import {
  ContentStore,
  type ContentEvents,
  type ContentStoreOptions,
  type DocumentFiles,
} from './contentStore';
import type {StoredFile} from './library';
import {resolveLocations} from './locations';
import type {RecoveryTarget} from './recoveryCopies';
import {MAX_WAITING_SAVES, type WaitingSave} from './saveFailures';
import type {SaveRequest} from './saver';
import {SettingsStore} from './settingsStore';
import {convertTextImport} from '../import/convert';
import {
  hymnOne,
  HYMN_ONE_ID,
  itemId,
  service,
  SUNDAY_ID,
  EVENING_ID,
} from './testFiles';

const ROOT = resolve('/data');
const {locations} = resolveLocations(
  {},
  {documents: ROOT, developmentFolder: null},
);
const SONG = testId(songIdSchema, HYMN_ONE_ID);
const SUNDAY = testId(serviceIdSchema, SUNDAY_ID);
const EVENING = testId(serviceIdSchema, EVENING_ID);
const TEMPLATE_ID = 'c63a2e74-9a3b-4c4d-8e5f-607182930415';
const TEMPLATE = testId(templateIdSchema, TEMPLATE_ID);

function stored<T>(
  parse: (text: string, file: string) => Result<LoadedFile<T>, FileError>,
  json: object,
  file: string,
): StoredFile<T> {
  const parsed = parse(JSON.stringify(json), file);
  if (!parsed.ok) {
    throw new Error(parsed.error.message);
  }
  return {...parsed.value, file};
}

function songFile(json: object = hymnOne()) {
  return stored(parseGroupedSong, json, join(locations.songs, 'hymn.llsong'));
}

function serviceFile(id: string, items: readonly object[]) {
  return stored(
    parseService,
    service(id, '2026-11-01T11:00', items),
    join(locations.services, `${id}.llservice`),
  );
}

function templateFile(
  items: readonly object[] = [
    {id: itemId(21), header: '찬양'},
    {id: itemId(22), slot: 'song', title: '찬양'},
  ],
  id = TEMPLATE_ID,
) {
  return stored(
    parseTemplate,
    {
      format: 'llservice',
      schemaVersion: 1,
      id,
      name: '주일',
      order: items,
    },
    join(locations.templates, `${id}.llservice`),
  );
}

interface FakeFiles extends DocumentFiles {
  readonly written: string[];
  readonly removed: string[];
  readonly texts: Map<string, string>;
  readonly waiting: WaitingSave[];
  readonly saved: string[];
  failing: ReadonlySet<string>;
  failAll: boolean;
  reminded: number;
}

function fakeFiles(): FakeFiles {
  const files: FakeFiles = {
    written: [],
    removed: [],
    texts: new Map(),
    waiting: [],
    saved: [],
    failing: new Set(),
    failAll: false,
    reminded: 0,
    failures: {
      waiting: save => {
        files.waiting.push(save);
      },
      saved: file => {
        files.saved.push(file);
      },
      remind: () => {
        files.reminded++;
      },
    },
    write: (request: SaveRequest) => {
      const {file} = request.target;
      files.written.push(file);
      if (files.failAll || files.failing.has(file)) {
        return Promise.resolve({
          ok: false,
          error: {file, message: 'disk full'},
        });
      }
      files.texts.set(file, request.text);
      return Promise.resolve({ok: true, value: undefined});
    },
    remove: (target: RecoveryTarget) => {
      files.removed.push(target.file);
      if (files.failAll || files.failing.has(target.file)) {
        return Promise.resolve({
          ok: false,
          error: {file: target.file, message: 'disk full'},
        });
      }
      files.texts.delete(target.file);
      return Promise.resolve({ok: true, value: undefined});
    },
  };
  return files;
}

function fakeEvents() {
  return {
    songChanged: vi.fn(),
    songsListChanged: vi.fn(),
    serviceChanged: vi.fn(),
    servicesListChanged: vi.fn(),
    templateChanged: vi.fn(),
    templatesListChanged: vi.fn(),
  } satisfies ContentEvents;
}

function quietLog(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    flush: () => Promise.resolve(),
  };
}

function setUp(
  services: ReadonlyArray<
    StoredFile<ReturnType<typeof serviceFile>['data']>
  > = [],
  options: Partial<
    Pick<
      ContentStoreOptions,
      'writeDelayMs' | 'openServiceId' | 'templates' | 'songs' | 'settings'
    >
  > = {},
  files = fakeFiles(),
) {
  const events = fakeEvents();
  const song = songFile({...hymnOne(), copyright: 'public domain'});
  const log = quietLog();
  const store = new ContentStore({
    locations,
    songs: new Map([[HYMN_ONE_ID, song]]),
    services: new Map(services.map(item => [item.data.id, item])),
    templates: new Map([[TEMPLATE_ID, templateFile()]]),
    files,
    events,
    log,
    writeDelayMs: 0,
    ...options,
  });
  onTestFinished(() => store.dispose());
  return {store, files, events, song, log};
}

function songEdit(
  store: ContentStore,
  title: string,
  baseRevision: number,
): ContentEdit {
  const document = store.song(SONG);
  if (document === null) throw new Error('Missing fixture song');
  return {
    type: 'song.update',
    song: {...document.song, title},
    baseRevision,
  };
}

function importSetup(
  services: Parameters<typeof setUp>[0] = [],
  options: Parameters<typeof setUp>[1] = {},
  labelOptions: {
    readonly access?: 'editable' | 'readOnly';
    readonly count?: number;
  } = {},
) {
  const files = fakeFiles();
  const labels = parseSettingsDocument({
    name: 'labels',
    revision: 1,
    access: labelOptions.access ?? 'editable',
    value: {
      format: 'llsettings.labels',
      schemaVersion: 1,
      labels: Array.from({length: labelOptions.count ?? 0}, (_, index) => ({
        name: `Existing ${index}`,
        color: 'teal',
        key: null,
      })),
      future: 'kept',
    },
  });
  if (!labels.ok) throw new Error('Invalid labels fixture');
  const settings = new SettingsStore({
    documents: new Map([['labels', labels.value]]),
    problems: [],
    log: quietLog(),
    saving: {folder: locations.settings, files, delayMs: 0},
  });
  onTestFinished(() => settings.dispose());
  return {...setUp(services, {...options, settings}, files), settings};
}

const importedDraft = {
  title: 'Invented import',
  slides: [{label: 'New label', lines: ['Invented line']}],
};

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

  it('names a waiting 틀 without a name by its file name', async () => {
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

  it('names a waiting 틀 by its name', async () => {
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
      files: fakeFiles(),
      events: fakeEvents(),
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

describe('ContentStore 구성 edits across files', () => {
  const picks = () => [
    serviceFile(EVENING_ID, [
      {id: itemId(1), song: HYMN_ONE_ID, arrangement: '주일용'},
    ]),
    serviceFile(SUNDAY_ID, [
      {id: itemId(2), song: HYMN_ONE_ID, arrangement: '주일용'},
      {id: itemId(3), song: HYMN_ONE_ID},
    ]),
  ];

  it('renames a 구성 in the song and in every item that picks it, song first', async () => {
    const {store, files} = setUp(picks());

    const answer = await store.apply({
      type: 'song.arrangement.rename',
      songId: SONG,
      from: '주일용',
      to: '짧게',
    });

    expect(answer).toEqual({ok: true, value: {id: SONG, revision: 2}});
    expect(store.song(SONG)?.song.arrangements?.map(({name}) => name)).toEqual([
      '짧게',
      '비어 있음',
    ]);
    expect(store.service(SUNDAY)?.service.order).toEqual([
      {id: itemId(2), song: HYMN_ONE_ID, arrangement: '짧게'},
      {id: itemId(3), song: HYMN_ONE_ID},
    ]);
    const [songWrite, ...serviceWrites] = files.written;
    expect(songWrite).toBe(join(locations.songs, 'hymn.llsong'));
    expect(serviceWrites).toEqual(
      [EVENING_ID, SUNDAY_ID]
        .sort()
        .map(id => join(locations.services, `${id}.llservice`)),
    );
  });

  it('writes the rest when a file in the middle fails, and names that file', async () => {
    const services = picks();
    const {store, files, log} = setUp(services);
    const [firstService] = [EVENING_ID, SUNDAY_ID].sort();
    const failing = join(locations.services, `${firstService ?? ''}.llservice`);
    files.failing = new Set([failing]);

    const answer = await store.apply({
      type: 'song.arrangement.rename',
      songId: SONG,
      from: '주일용',
      to: '짧게',
    });

    expect(answer).toEqual({
      ok: false,
      error: {
        reason: 'write-failed',
        message: 'disk full',
        applied: {id: SONG, revision: 2},
        unchangedFiles: [failing],
      },
    });
    expect(files.written).toHaveLength(3);
    expect(files.texts.has(failing)).toBe(false);
    expect(log.warn).toHaveBeenCalledTimes(1);
    expect(store.service(EVENING)?.service.order).toEqual([
      {id: itemId(1), song: HYMN_ONE_ID, arrangement: '짧게'},
    ]);
    files.failing = new Set();
    await store.flush();
    expect(files.written).toHaveLength(4);
    expect(files.texts.get(failing)).toContain('짧게');
  });

  it('makes an older 예배 순서 editor stale after a rename rewrote it', async () => {
    const {store} = setUp(picks());
    const before = store.service(SUNDAY);

    await store.apply({
      type: 'song.arrangement.rename',
      songId: SONG,
      from: '주일용',
      to: '짧게',
    });
    const answer = await store.apply({
      type: 'service.update',
      service: before?.service ?? serviceFile(SUNDAY_ID, []).data,
      baseRevision: before?.revision ?? 0,
    });

    expect(answer).toMatchObject({ok: false, error: {reason: 'stale'}});
    expect(store.service(SUNDAY)?.service.order[0]).toMatchObject({
      arrangement: '짧게',
    });
  });

  it('deletes a 구성 and sends the items that picked it to 기본', async () => {
    const {store} = setUp(picks());

    await store.apply({
      type: 'song.arrangement.delete',
      songId: SONG,
      name: '주일용',
    });

    expect(store.service(SUNDAY)?.service.order[0]).toEqual({
      id: itemId(2),
      song: HYMN_ONE_ID,
    });
  });

  it('leaves references in a newer-version service untouched during a 구성 rename', async () => {
    const {store, files, events} = setUp([
      {
        ...serviceFile(SUNDAY_ID, [
          {id: itemId(1), song: HYMN_ONE_ID, arrangement: '주일용'},
        ]),
        access: 'readOnly',
      },
    ]);
    const before = store.service(SUNDAY);

    await store.apply({
      type: 'song.arrangement.rename',
      songId: SONG,
      from: '주일용',
      to: '짧게',
    });

    expect(store.service(SUNDAY)).toEqual(before);
    expect(files.written).toEqual([join(locations.songs, 'hymn.llsong')]);
    expect(events.serviceChanged).not.toHaveBeenCalled();
  });

  it('refuses a rename to a name the song has, or from one it lacks', async () => {
    const {store} = setUp(picks());

    expect(
      await store.apply({
        type: 'song.arrangement.rename',
        songId: SONG,
        from: '주일용',
        to: '비어 있음',
      }),
    ).toMatchObject({ok: false, error: {reason: 'invalid'}});
    expect(
      await store.apply({
        type: 'song.arrangement.rename',
        songId: SONG,
        from: '없는 구성',
        to: '짧게',
      }),
    ).toMatchObject({ok: false, error: {reason: 'not-found'}});
  });
});

describe('ContentStore 구성 references in 틀', () => {
  const OTHER_TEMPLATE_ID = 'd74b3f85-ab4c-4d5e-9f60-718293041526';
  const READONLY_TEMPLATE_ID = 'e85c4096-bc5d-4e6f-8071-829304152637';
  const matching = (id = TEMPLATE_ID) =>
    templateFile(
      [
        {
          id: itemId(23),
          song: HYMN_ONE_ID,
          arrangement: '주일용',
          future: {enabled: true},
        },
        {id: itemId(24), song: HYMN_ONE_ID, arrangement: '비어 있음'},
      ],
      id,
    );

  it.each(['rename', 'delete'] as const)(
    'updates a 틀 revision and push on 구성 %s, including future creation and import',
    async action => {
      const template = matching();
      const {store, files, events} = setUp([serviceFile(SUNDAY_ID, [])], {
        templates: new Map([[TEMPLATE_ID, template]]),
      });
      const before = store.template(TEMPLATE);
      if (before === null) throw new Error('Missing test template');

      const answer = await store.apply(
        action === 'rename'
          ? {
              type: 'song.arrangement.rename',
              songId: SONG,
              from: '주일용',
              to: '짧게',
            }
          : {type: 'song.arrangement.delete', songId: SONG, name: '주일용'},
      );

      expect(answer).toEqual({ok: true, value: {id: SONG, revision: 2}});
      const after = store.template(TEMPLATE);
      expect(after?.revision).toBe(2);
      const picked = after?.template.order[0];
      if (action === 'rename') {
        expect(picked).toHaveProperty('arrangement', '짧게');
      } else {
        expect(picked).not.toHaveProperty('arrangement');
      }
      expect(picked).toHaveProperty('future', {enabled: true});
      expect(after?.template.order[1]).toHaveProperty(
        'arrangement',
        '비어 있음',
      );
      expect(files.written).toEqual([
        join(locations.songs, 'hymn.llsong'),
        template.file,
      ]);
      const saved = parseTemplate(
        files.texts.get(template.file) ?? '',
        template.file,
      );
      expect(saved.ok && saved.value.data.order).toEqual(after?.template.order);
      expect(events.templateChanged).toHaveBeenCalledTimes(1);
      expect(events.templateChanged).toHaveBeenCalledWith({
        templateId: TEMPLATE,
        document: after,
      });
      expect(events.templatesListChanged).not.toHaveBeenCalled();
      expect(
        await store.apply({
          type: 'template.update',
          template: before.template,
          baseRevision: before.revision,
        }),
      ).toMatchObject({ok: false, error: {reason: 'stale'}});

      const created = await store.apply({
        type: 'service.create',
        name: '틀로 만든 예배',
        date: '2026-11-08T11:00',
        templateId: TEMPLATE,
      });
      if (!created.ok) throw new Error('Could not create a test service');
      await store.apply({
        type: 'service.importItems',
        serviceId: SUNDAY,
        from: {kind: 'template', id: TEMPLATE},
        itemIds: [testId(serviceItemIdSchema, itemId(23))],
      });
      const expected = action === 'rename' ? '짧게' : undefined;
      expect(store.service(created.value.id)?.service.order[0]).toMatchObject({
        song: HYMN_ONE_ID,
      });
      expect(
        store.service(created.value.id)?.service.order[0],
      ).not.toHaveProperty('id', itemId(23));
      for (const item of [
        store.service(created.value.id)?.service.order[0],
        store.service(SUNDAY)?.service.order[0],
      ]) {
        expect(item).toMatchObject(
          expected === undefined
            ? {song: HYMN_ONE_ID}
            : {arrangement: expected},
        );
        if (expected === undefined) {
          expect(item).not.toHaveProperty('arrangement');
        }
      }
    },
  );

  it('continues after a failed 틀 write, names it, and retries only that file', async () => {
    const first = matching();
    const second = matching(OTHER_TEMPLATE_ID);
    const {store, files, events, log} = setUp(
      [
        serviceFile(SUNDAY_ID, [
          {id: itemId(1), song: HYMN_ONE_ID, arrangement: '주일용'},
        ]),
      ],
      {
        templates: new Map([
          [OTHER_TEMPLATE_ID, second],
          [TEMPLATE_ID, first],
        ]),
      },
    );
    files.failing = new Set([first.file]);

    const answer = await store.apply({
      type: 'song.arrangement.rename',
      songId: SONG,
      from: '주일용',
      to: '짧게',
    });

    expect(answer).toEqual({
      ok: false,
      error: {
        reason: 'write-failed',
        message: 'disk full',
        applied: {id: SONG, revision: 2},
        unchangedFiles: [first.file],
      },
    });
    expect(files.written).toEqual([
      join(locations.songs, 'hymn.llsong'),
      join(locations.services, `${SUNDAY_ID}.llservice`),
      first.file,
      second.file,
    ]);
    expect(files.texts.has(first.file)).toBe(false);
    expect(files.texts.get(second.file)).toContain('짧게');
    expect(store.template(TEMPLATE)?.revision).toBe(2);
    expect(store.template(OTHER_TEMPLATE_ID)?.revision).toBe(2);
    expect(events.templateChanged).toHaveBeenCalledTimes(2);
    expect(log.warn).toHaveBeenCalledTimes(1);
    files.failing = new Set();
    await store.flush();
    expect(files.written).toHaveLength(5);
    expect(files.written.at(-1)).toBe(first.file);
    expect(files.texts.get(first.file)).toContain('짧게');
  });

  it('leaves read-only and unrelated 틀 unchanged and sends no push for them', async () => {
    const readonly = {
      ...matching(READONLY_TEMPLATE_ID),
      access: 'readOnly' as const,
    };
    const unrelated = templateFile(undefined, OTHER_TEMPLATE_ID);
    const changed = matching();
    const {store, files, events} = setUp([], {
      templates: new Map([
        [READONLY_TEMPLATE_ID, readonly],
        [OTHER_TEMPLATE_ID, unrelated],
        [TEMPLATE_ID, changed],
      ]),
    });
    const beforeReadonly = store.template(READONLY_TEMPLATE_ID);
    const beforeUnrelated = store.template(OTHER_TEMPLATE_ID);

    await store.apply({
      type: 'song.arrangement.rename',
      songId: SONG,
      from: '주일용',
      to: '짧게',
    });

    expect(store.template(READONLY_TEMPLATE_ID)).toEqual(beforeReadonly);
    expect(store.template(OTHER_TEMPLATE_ID)).toEqual(beforeUnrelated);
    expect(events.templateChanged).toHaveBeenCalledTimes(1);
    expect(files.written).toEqual([
      join(locations.songs, 'hymn.llsong'),
      changed.file,
    ]);
  });
});

describe('ContentStore 예배 순서 and 틀 edits', () => {
  it('creates a 예배 순서 from a 틀 with new item ids, or empty', async () => {
    const {store} = setUp();

    const fromTemplate = await store.apply({
      type: 'service.create',
      name: '주일 예배',
      date: '2026-11-08T11:00',
      templateId: TEMPLATE,
    });
    const empty = await store.apply({
      type: 'service.create',
      name: '',
      date: '2026-11-11T19:30',
      templateId: null,
    });

    const id = fromTemplate.ok ? fromTemplate.value.id : '';
    const order = store.service(id)?.service.order ?? [];
    expect(
      order.map(item => ('header' in item ? item.header : 'slot')),
    ).toEqual(['찬양', '찬양']);
    expect(order.map(({id: itemIdOf}) => itemIdOf)).not.toContain(itemId(21));
    const emptyId = empty.ok ? empty.value.id : '';
    expect(store.service(emptyId)?.service.order).toEqual([]);
  });

  it('appends imported items in source order with new ids, from a 예배 순서 or a 틀', async () => {
    const {store} = setUp([
      serviceFile(SUNDAY_ID, [{id: itemId(1), header: '말씀'}]),
      serviceFile(EVENING_ID, [
        {id: itemId(2), header: '찬양'},
        {id: itemId(3), song: HYMN_ONE_ID},
      ]),
    ]);

    await store.apply({
      type: 'service.importItems',
      serviceId: SUNDAY,
      from: {kind: 'service', id: EVENING},
      itemIds: [
        testId(serviceItemIdSchema, itemId(3)),
        testId(serviceItemIdSchema, itemId(2)),
      ],
    });
    await store.apply({
      type: 'service.importItems',
      serviceId: SUNDAY,
      from: {kind: 'template', id: TEMPLATE},
      itemIds: [testId(serviceItemIdSchema, itemId(22))],
    });

    const order = store.service(SUNDAY)?.service.order ?? [];
    expect(
      order.map(item => Object.keys(item).find(key => key !== 'id')),
    ).toEqual(['header', 'header', 'song', 'header']);
    expect(new Set(order.map(({id}) => id)).size).toBe(4);
  });

  it('refuses an import of an item the source lacks', async () => {
    const {store} = setUp([serviceFile(SUNDAY_ID, [])]);

    const answer = await store.apply({
      type: 'service.importItems',
      serviceId: SUNDAY,
      from: {kind: 'template', id: TEMPLATE},
      itemIds: [testId(serviceItemIdSchema, itemId(99))],
    });

    expect(answer).toMatchObject({ok: false, error: {reason: 'invalid'}});
    expect(store.service(SUNDAY)?.service.order).toEqual([]);
  });

  it('saves a 예배 순서 as a 틀 with its time and new item ids', async () => {
    const {store, events} = setUp([
      serviceFile(SUNDAY_ID, [{id: itemId(1), header: '찬양'}]),
    ]);

    const answer = await store.apply({
      type: 'service.saveAsTemplate',
      serviceId: SUNDAY,
      name: '주일 오전',
    });

    const id = answer.ok ? answer.value.id : '';
    expect(store.template(id)?.template).toMatchObject({
      name: '주일 오전',
      time: '11:00',
      order: [{header: '찬양'}],
    });
    expect(store.template(id)?.template.order[0]?.id).not.toBe(itemId(1));
    expect(events.templatesListChanged).toHaveBeenCalledTimes(1);
  });

  it('updates and deletes a 예배 순서 and a 틀', async () => {
    const {store, files} = setUp([serviceFile(SUNDAY_ID, [])]);
    const sunday = store.service(SUNDAY);
    const template = store.template(TEMPLATE);

    expect(
      await store.apply({
        type: 'service.update',
        service: {
          ...(sunday?.service ?? serviceFile(SUNDAY_ID, []).data),
          name: '새 이름',
        },
        baseRevision: 1,
      }),
    ).toEqual({ok: true, value: {id: SUNDAY, revision: 2}});
    expect(
      await store.apply({
        type: 'template.update',
        template: {
          ...(template?.template ?? templateFile().data),
          name: '새 틀',
        },
        baseRevision: 1,
      }),
    ).toEqual({ok: true, value: {id: TEMPLATE, revision: 2}});
    await store.apply({type: 'service.delete', serviceId: SUNDAY});
    await store.apply({type: 'template.delete', templateId: TEMPLATE});

    expect(store.serviceList()).toEqual([]);
    expect(store.templateList()).toEqual([]);
    expect(files.removed).toHaveLength(2);
  });
});

describe('ContentStore lists', () => {
  it('counts the items of each 예배 순서 and 틀 without their headers', () => {
    const {store} = setUp([
      serviceFile(SUNDAY, [
        {id: itemId(1), header: '찬양'},
        {id: itemId(2), song: HYMN_ONE_ID},
        {id: itemId(3), slot: 'song', title: '찬양'},
        {id: itemId(4), header: '말씀'},
        {id: itemId(5), slot: 'bible', title: '말씀'},
      ]),
    ]);
    expect(store.serviceList()).toMatchObject([{id: SUNDAY, itemCount: 1}]);
    expect(store.templateList()).toMatchObject([
      {id: TEMPLATE_ID, itemCount: 0},
    ]);
  });
});

describe('ContentStore persistence and notifications', () => {
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

  it('serializes a cross-file edit and deletion while the first write waits', async () => {
    const {store, files} = setUp();
    const write = files.write;
    let release = (): void => undefined;
    const gate = new Promise<void>(resolve => {
      release = () => resolve();
    });
    files.write = async request => {
      await gate;
      return write(request);
    };
    const rename = store.apply({
      type: 'song.arrangement.rename',
      songId: SONG,
      from: '주일용',
      to: '짧게',
    });
    const deletion = store.apply({type: 'song.delete', songId: SONG});
    await Promise.resolve();
    expect(files.removed).toEqual([]);
    release();

    await Promise.all([rename, deletion]);
    await store.flush();

    expect(store.song(SONG)).toBeNull();
    expect(files.written).toHaveLength(1);
    expect(files.removed).toHaveLength(1);
  });

  it('pushes only the list whose displayed fields changed', async () => {
    const {store, events} = setUp();

    await store.apply(songEdit(store, '바뀐 제목', 1));

    expect(events.songsListChanged).toHaveBeenCalledTimes(1);
    expect(events.servicesListChanged).not.toHaveBeenCalled();
    expect(events.templatesListChanged).not.toHaveBeenCalled();
  });

  it('refreshes library usage after an item is added or its service is renamed', async () => {
    const {store, events} = setUp([serviceFile(SUNDAY_ID, [])]);
    const sunday = store.service(SUNDAY);
    if (sunday === null) throw new Error('Missing test service');
    await store.apply({
      type: 'service.update',
      baseRevision: 1,
      service: {
        ...sunday.service,
        name: '수정 예배',
        order: [{id: testId(serviceItemIdSchema, itemId(1)), song: SONG}],
      },
    });

    expect(store.songList()[0]?.usedBy).toEqual([
      {id: SUNDAY, name: '수정 예배'},
    ]);
    expect(events.songsListChanged).toHaveBeenCalledTimes(1);
    expect(events.servicesListChanged).toHaveBeenCalledTimes(1);
    expect(events.templatesListChanged).not.toHaveBeenCalled();
  });

  it('sorts numbered titles using Korean numeric collation', async () => {
    const {store} = setUp();
    const second = await store.apply({type: 'song.create'});
    const tenth = await store.apply({type: 'song.create'});
    for (const [created, title] of [
      [second, '찬송 2'],
      [tenth, '찬송 10'],
    ] as const) {
      if (!created.ok) throw new Error('Could not create a test song');
      const document = store.song(created.value.id);
      if (document === null) throw new Error('Missing test song');
      await store.apply({
        type: 'song.update',
        song: {...document.song, title},
        baseRevision: 1,
      });
    }
    expect(store.songList().map(({title}) => title)).toEqual([
      '만복의 근원 하나님',
      '찬송 2',
      '찬송 10',
    ]);
  });

  it('refuses deletion of the open service without removing its file', async () => {
    const {store, files} = setUp([serviceFile(SUNDAY_ID, [])], {
      openServiceId: SUNDAY,
    });

    expect(
      await store.apply({type: 'service.delete', serviceId: SUNDAY}),
    ).toMatchObject({ok: false, error: {reason: 'invalid'}});
    expect(store.service(SUNDAY)).not.toBeNull();
    expect(files.removed).toEqual([]);
  });

  it('refuses schema-version changes in whole-document updates', async () => {
    const {store, song} = setUp();

    expect(
      await store.apply({
        type: 'song.update',
        song: {...song.data, schemaVersion: 99},
        baseRevision: 1,
      }),
    ).toMatchObject({ok: false, error: {reason: 'invalid'}});
    expect(store.song(SONG)?.revision).toBe(1);
  });

  it('clears optional song fields omitted from a whole-document update', async () => {
    const {store, song} = setUp();
    const {arrangements: _arrangements, ...edited} = song.data;

    await store.apply({type: 'song.update', song: edited, baseRevision: 1});

    expect(store.song(SONG)?.song).not.toHaveProperty('arrangements');
    expect(store.song(SONG)?.song).toHaveProperty('copyright', 'public domain');
  });

  it('makes template updates stale after another template edit', async () => {
    const {store} = setUp();
    const before = store.template(TEMPLATE);
    if (before === null) throw new Error('Missing test template');
    await store.apply({
      type: 'template.update',
      template: {...before.template, name: '새 틀'},
      baseRevision: 1,
    });

    expect(
      await store.apply({
        type: 'template.update',
        template: before.template,
        baseRevision: 1,
      }),
    ).toMatchObject({ok: false, error: {reason: 'stale'}});
  });
});
