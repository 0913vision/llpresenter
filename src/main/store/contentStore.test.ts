import {join, resolve} from 'node:path';
import {describe, expect, it, onTestFinished, vi} from 'vitest';
import type {Result} from '@shared/result';
import type {ContentEdit} from '@shared/schema/contentEdit';
import type {FileError, LoadedFile} from '@shared/schema/fileFormat';
import {
  serviceIdSchema,
  serviceItemIdSchema,
  songIdSchema,
  templateIdSchema,
} from '@shared/schema/ids';
import {parseService, parseTemplate} from '@shared/schema/service';
import {parseSong} from '@shared/schema/song';
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
import type {SaveRequest} from './saver';
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
  return stored(parseSong, json, join(locations.songs, 'hymn.llsong'));
}

function serviceFile(id: string, items: readonly object[]) {
  return stored(
    parseService,
    service(id, '2026-11-01T11:00', items),
    join(locations.services, `${id}.llservice`),
  );
}

function templateFile() {
  return stored(
    parseTemplate,
    {
      format: 'llservice',
      schemaVersion: 1,
      id: TEMPLATE_ID,
      name: '주일',
      order: [
        {id: itemId(21), header: '찬양'},
        {id: itemId(22), slot: 'song', title: '찬양'},
      ],
    },
    join(locations.templates, 'sunday.llservice'),
  );
}

interface FakeFiles extends DocumentFiles {
  readonly written: string[];
  readonly removed: string[];
  readonly texts: Map<string, string>;
  failing: ReadonlySet<string>;
}

function fakeFiles(): FakeFiles {
  const files: FakeFiles = {
    written: [],
    removed: [],
    texts: new Map(),
    failing: new Set(),
    write: (request: SaveRequest) => {
      const {file} = request.target;
      files.written.push(file);
      if (files.failing.has(file)) {
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
      if (files.failing.has(target.file)) {
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
  options: Pick<ContentStoreOptions, 'writeDelayMs' | 'openServiceId'> = {},
) {
  const files = fakeFiles();
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

function songEdit(title: string, baseRevision: number): ContentEdit {
  const {song} = setUp();
  return {
    type: 'song.update',
    song: {...song.data, title},
    baseRevision,
  };
}

describe('ContentStore song updates', () => {
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
    await store.apply(songEdit('첫 고침', 1));

    const answer = await store.apply(songEdit('늦은 고침', 1));

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
      slides: [{lines: ['새 가사']}, ...song.data.slides.slice(1)],
    };

    await store.apply({type: 'song.update', song: lyrics, baseRevision: 1});
    expect(events.songsListChanged).not.toHaveBeenCalled();
    await store.apply(songEdit('새 제목', 2));

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
        [HYMN_ONE_ID, songFile({...hymnOne(), schemaVersion: 99})],
      ]),
      services: new Map(),
      templates: new Map(),
      files: fakeFiles(),
      events: fakeEvents(),
      log: quietLog(),
    });
    expect(await newer.apply(songEdit('고침', 1))).toMatchObject({
      ok: false,
      error: {reason: 'read-only'},
    });
  });
});

describe('ContentStore song creation and deletion', () => {
  it('creates 새 곡, then 새 곡 2, each with one blank 장', async () => {
    const {store, files} = setUp();

    const first = await store.apply({type: 'song.create'});
    const second = await store.apply({type: 'song.create'});

    const titles = store.songList().map(({title}) => title);
    expect(titles).toEqual(['만복의 근원 하나님', '새 곡', '새 곡 2']);
    expect(first.ok && second.ok).toBe(true);
    const id = first.ok ? first.value.id : '';
    expect(store.song(id)?.song.slides).toEqual([{lines: []}]);
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
    ).toEqual(['찬양', 'slot']);
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
    ).toEqual(['header', 'header', 'song', 'header', 'slot']);
    expect(new Set(order.map(({id}) => id)).size).toBe(5);
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
    await store.apply(songEdit('첫 제목', 1));
    await store.apply(songEdit('마지막 제목', 2));

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
    await store.apply(songEdit('최신 제목', 2));
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
    expect(await store.apply(songEdit('다음 제목', 1))).toMatchObject({
      ok: true,
    });
  });

  it('does not recreate a deleted song from its pending autosave', async () => {
    const {store, files} = setUp([], {writeDelayMs: 500});
    await store.apply(songEdit('지울 제목', 1));
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

    await store.apply(songEdit('바뀐 제목', 1));

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
