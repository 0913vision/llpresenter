import {describe, expect, it} from 'vitest';
import {createServiceItemId} from '@core/schema/ids';
import {
  SONG,
  SUNDAY,
  setUp,
  serviceFile,
  songFile,
} from '@fixtures/main/store/contentStoreFixtures';
import {SUNDAY_ID, HYMN_ONE_ID, itemId} from '@fixtures/main/store/testFiles';

const first = createServiceItemId(itemId(1));
function fixture() {
  const source = songFile().data;
  const slides = source.slides.map(slide => ({
    ...slide,
    lines: ['Invented item lyric'],
  }));
  return {
    ...setUp([
      serviceFile(SUNDAY_ID, [
        {id: first, song: HYMN_ONE_ID, slides, memo: 'Keep item memo'},
        {id: itemId(2), song: HYMN_ONE_ID, slides: source.slides},
      ]),
    ]),
    slides,
  };
}
const command = {
  type: 'service.song.saveToLibrary',
  serviceId: SUNDAY,
  itemId: first,
  baseRevision: 1,
  songRevision: 1,
} as const;

describe('explicit song item transfers', () => {
  it('saves item lyrics to the library without changing either service item', async () => {
    const {store, slides, files, events} = fixture();
    const service = store.service(SUNDAY);
    expect(await store.apply(command)).toEqual({
      ok: true,
      value: {id: SONG, revision: 2},
    });
    expect(store.song(SONG)?.song.slides).toEqual(slides);
    expect(store.song(SONG)?.song.title).toBe('만복의 근원 하나님');
    expect(store.service(SUNDAY)).toEqual(service);
    expect(events.serviceChanged).not.toHaveBeenCalled();
    expect(files.written).toHaveLength(1);
  });
  it('reloads only the chosen item and leaves library and other item revisions alone', async () => {
    const {store, events} = fixture();
    const library = store.song(SONG);
    const other = store.service(SUNDAY)?.service.order[1];
    expect(
      await store.apply({...command, type: 'service.song.reloadFromLibrary'}),
    ).toEqual({ok: true, value: {id: SUNDAY, revision: 2}});
    expect(store.service(SUNDAY)?.service.order[0]).toMatchObject({
      slides: library?.song.slides,
      memo: 'Keep item memo',
    });
    expect(store.service(SUNDAY)?.service.order[1]).toEqual(other);
    expect(store.song(SONG)).toEqual(library);
    expect(events.songChanged).not.toHaveBeenCalled();
  });
  it.each([
    'service.song.saveToLibrary',
    'service.song.reloadFromLibrary',
  ] as const)('checks both captured revisions for %s', async type => {
    const {store, files} = fixture();
    for (const changes of [{baseRevision: 2}, {songRevision: 2}]) {
      expect(await store.apply({...command, type, ...changes})).toMatchObject({
        ok: false,
        error: {reason: 'stale'},
      });
    }
    expect(files.written).toEqual([]);
  });
  it('refuses saving an empty item over a nonempty library song', async () => {
    const {store, files} = setUp([
      serviceFile(SUNDAY_ID, [{id: first, song: HYMN_ONE_ID, slides: []}]),
    ]);
    expect(await store.apply(command)).toMatchObject({
      ok: false,
      error: {reason: 'invalid'},
    });
    expect(store.song(SONG)?.revision).toBe(1);
    expect(files.written).toEqual([]);
  });
  it('reports a failed write as applied and retries without applying twice', async () => {
    const {store, files} = fixture();
    files.failAll = true;
    expect(await store.apply(command)).toMatchObject({
      ok: false,
      error: {reason: 'write-failed', applied: {id: SONG, revision: 2}},
    });
    files.failAll = false;
    await store.flush();
    expect(store.song(SONG)?.revision).toBe(2);
    expect(files.texts.size).toBe(1);
  });
});
