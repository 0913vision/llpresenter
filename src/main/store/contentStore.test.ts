import {createSongId, serviceItemIdSchema} from '@core/schema/ids';
import {parseTemplate} from '@core/schema/service';
import {testId} from '@core/schema/testHelpers';
import {basename, join} from 'node:path';
import {describe, expect, it, vi} from 'vitest';
import {MAX_WAITING_SAVES} from './saveFailures';
import {EVENING_ID, HYMN_ONE_ID, SUNDAY_ID, itemId} from './testFiles';
import {
  EVENING,
  SONG,
  SUNDAY,
  TEMPLATE,
  TEMPLATE_ID,
  importedDraft,
  locations,
  serviceFile,
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

describe('ContentStore 구성 references in 템플릿', () => {
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
    'updates a 템플릿 revision and push on 구성 %s, including future creation and import',
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
        name: '템플릿으로 만든 예배',
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

  it('continues after a failed 템플릿 write, names it, and retries only that file', async () => {
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

  it('retries every failed arrangement file without changing the applied name or revisions', async () => {
    const target = matching();
    const {store, files, song} = setUp(
      [
        serviceFile(SUNDAY_ID, [
          {id: itemId(1), song: HYMN_ONE_ID, arrangement: '주일용'},
        ]),
      ],
      {templates: new Map([[TEMPLATE_ID, target]])},
    );
    const failedFiles = [
      song.file,
      join(locations.services, `${SUNDAY_ID}.llservice`),
      target.file,
    ];
    files.failing = new Set(failedFiles);
    expect(
      await store.apply({
        type: 'song.arrangement.rename',
        songId: SONG,
        from: '주일용',
        to: '짧게',
      }),
    ).toMatchObject({ok: false});
    const revisions = [
      store.song(SONG)?.revision,
      store.service(SUNDAY)?.revision,
      store.template(TEMPLATE)?.revision,
    ];
    expect(await store.apply({type: 'saves.retry'})).toMatchObject({
      ok: false,
      error: {unchangedFiles: failedFiles},
    });
    files.failing = new Set();
    expect(await store.apply({type: 'saves.retry'})).toMatchObject({ok: true});
    expect(files.written).toEqual([
      ...failedFiles,
      ...failedFiles,
      ...failedFiles,
    ]);
    expect([
      store.song(SONG)?.revision,
      store.service(SUNDAY)?.revision,
      store.template(TEMPLATE)?.revision,
    ]).toEqual(revisions);
    for (const file of failedFiles) {
      expect(files.texts.get(file)).toContain('짧게');
    }
  });

  it('leaves read-only and unrelated 템플릿 unchanged and sends no push for them', async () => {
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

describe('ContentStore lists', () => {
  it('counts the items of each 예배 순서 and 템플릿 without their headers', () => {
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
      template: {...before.template, name: '새 템플릿'},
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
