import {serviceIdSchema, serviceItemIdSchema} from '@core/schema/ids';
import {parseService} from '@core/schema/service';
import {testId} from '@fixtures/core/schema/testHelpers';
import {join} from 'node:path';
import {describe, expect, it, vi} from 'vitest';
import {
  EVENING_ID,
  HYMN_ONE_ID,
  SUNDAY_ID,
  itemId,
  service,
} from '@fixtures/main/store/testFiles';
import {
  EVENING,
  SONG,
  SUNDAY,
  TEMPLATE,
  TEMPLATE_ID,
  locations,
  serviceFile,
  songFile,
  setUp,
  stored,
} from '@fixtures/main/store/contentStoreFixtures';

describe('ContentStore lists', () => {
  it('counts the items of each 예배 순서 and 템플릿 without their headers', () => {
    const {store} = setUp([
      serviceFile(SUNDAY, [
        {id: itemId(1), header: '찬양'},
        {slides: [], id: itemId(2), song: HYMN_ONE_ID},
        {id: itemId(3), header: '찬양'},
        {id: itemId(4), header: '말씀'},
        {id: itemId(5), header: '말씀'},
      ]),
    ]);
    expect(store.serviceList()).toMatchObject([{id: SUNDAY, itemCount: 1}]);
    expect(store.templateList()).toMatchObject([
      {id: TEMPLATE_ID, itemCount: 0},
    ]);
  });
});

describe('ContentStore persistence and notifications', () => {
  it('serializes a save and deletion while the first write waits', async () => {
    const {store, files} = setUp([
      serviceFile(SUNDAY_ID, [
        {id: itemId(1), song: HYMN_ONE_ID, slides: songFile().data.slides},
      ]),
    ]);
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
      type: 'service.song.saveToLibrary',
      serviceId: SUNDAY,
      itemId: testId(serviceItemIdSchema, itemId(1)),
      baseRevision: 1,
      songRevision: 1,
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
    const edited = {...song.data};
    delete edited.updatedAt;

    await store.apply({type: 'song.update', song: edited, baseRevision: 1});

    expect(store.song(SONG)?.song).not.toHaveProperty('updatedAt');
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

describe('ContentStore.openService', () => {
  const sundayFile = join(locations.services, `${SUNDAY_ID}.llservice`);
  const twoServices = () => [
    serviceFile(SUNDAY_ID, []),
    serviceFile(EVENING_ID, []),
  ];

  it('saves and publishes the open service before switching, and moves the delete guard', async () => {
    const {store, files} = setUp(twoServices(), {openServiceId: SUNDAY});
    const publish = vi.fn(() => Promise.resolve());

    expect(await store.openService(EVENING, publish)).toMatchObject({
      ok: true,
      value: {id: EVENING},
    });
    expect(files.written).toEqual([sundayFile]);
    expect(publish).toHaveBeenCalledOnce();
    expect(store.openServiceId).toBe(EVENING);
    expect(
      await store.apply({type: 'service.delete', serviceId: EVENING}),
    ).toMatchObject({ok: false, error: {reason: 'invalid'}});
    expect(
      (await store.apply({type: 'service.delete', serviceId: SUNDAY})).ok,
    ).toBe(true);
  });

  it('switches away from a read-only service without writing it', async () => {
    const readOnly = stored(
      parseService,
      {...service(SUNDAY_ID, '2026-11-01T11:00', []), schemaVersion: 2},
      sundayFile,
    );
    const {store, files} = setUp([readOnly, serviceFile(EVENING_ID, [])], {
      openServiceId: SUNDAY,
    });

    expect((await store.openService(EVENING, () => Promise.resolve())).ok).toBe(
      true,
    );
    expect(files.written).toEqual([]);
    expect(store.openServiceId).toBe(EVENING);
  });

  it('keeps the open service for an unknown id and when saving it fails', async () => {
    const {store, files} = setUp(twoServices(), {openServiceId: SUNDAY});
    const publish = vi.fn(() => Promise.resolve());
    const missing = testId(
      serviceIdSchema,
      '00000000-0000-4000-8000-000000000003',
    );

    expect(await store.openService(missing, publish)).toMatchObject({
      ok: false,
      error: {reason: 'not-found'},
    });
    expect(files.written).toEqual([]);
    files.failing = new Set([sundayFile]);
    expect((await store.openService(EVENING, publish)).ok).toBe(false);
    expect(store.openServiceId).toBe(SUNDAY);
    expect(publish).not.toHaveBeenCalled();
  });
});
