import {describe, expect, it} from 'vitest';
import {createServiceItemId} from '@core/schema/common/ids';
import {
  SONG,
  SUNDAY,
  setUp,
  serviceFile,
  songFile,
} from '@fixtures/main/store/contentStoreFixtures';
import {SUNDAY_ID, HYMN_ONE_ID, itemId} from '@fixtures/main/store/testFiles';
import {lyricsSlide, slideOf} from '@fixtures/core/slides';

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
        {
          id: first,
          kind: 'song',
          name: '곡',
          song: HYMN_ONE_ID,
          slides,
          future: 'Keep a field of the item',
        },
        {
          id: itemId(2),
          kind: 'song',
          name: '곡',
          song: HYMN_ONE_ID,
          slides: source.slides,
        },
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
    const reloaded = store.service(SUNDAY)?.service.order[0];
    expect(reloaded).toMatchObject({future: 'Keep a field of the item'});
    const slides =
      reloaded !== undefined && 'slides' in reloaded ? reloaded.slides : [];
    // NOTE(0913vision): The item gets the song as a new item would: its title
    // with 전주, its slides, and its title again with 후주.
    expect(slides[0]).toMatchObject({
      label: '전주',
      texts: {제목: library?.song.title},
    });
    expect(slides.slice(1, -1).map(slide => slide.texts)).toEqual(
      library?.song.slides.map(slide => slide.texts),
    );
    expect(slides.at(-1)).toMatchObject({label: '후주', next: '(후주)'});
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
      serviceFile(SUNDAY_ID, [
        {id: first, kind: 'song', name: '곡', song: HYMN_ONE_ID, slides: []},
      ]),
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

describe('songs kept with their title apart', () => {
  const opening = slideOf(10, 'songTitle', {
    texts: {제목: '만복의 근원 하나님'},
    label: '전주',
  });
  const closing = slideOf(11, 'songTitle', {
    texts: {제목: '만복의 근원 하나님'},
    label: '후주',
    next: '(후주)',
  });
  const verse = lyricsSlide(12, '찬양 첫 줄', {label: '1절'});

  it('saves an item to the library with its 전주 title apart, without the label, and without its 후주 title', async () => {
    const {store} = setUp([
      serviceFile(SUNDAY_ID, [
        {
          id: first,
          kind: 'song',
          name: '곡',
          song: HYMN_ONE_ID,
          slides: [opening, verse, closing],
        },
      ]),
    ]);

    expect((await store.apply(command)).ok).toBe(true);

    const {label: _label, ...title} = opening;
    expect(store.song(SONG)?.song).toMatchObject({
      titleSlide: title,
      slides: [verse],
    });
  });

  it('saves a hymn that opens with a picture back without its 후주 copy', async () => {
    const picture = slideOf(20, 'lyrics', {
      texts: {},
      background: {kind: 'color', color: '#112233'},
    });
    const {store} = setUp([
      serviceFile(SUNDAY_ID, [
        {
          id: first,
          kind: 'song',
          name: '곡',
          song: HYMN_ONE_ID,
          slides: [
            {...picture, label: '전주'},
            verse,
            {
              ...picture,
              id: slideOf(21, 'lyrics').id,
              label: '후주',
              next: '(후주)',
            },
          ],
        },
      ]),
    ]);

    expect((await store.apply(command)).ok).toBe(true);

    expect(store.song(SONG)?.song).toMatchObject({
      titleSlide: picture,
      slides: [verse],
    });
  });

  it('imports a song the same way', async () => {
    const {store} = setUp([]);

    const result = await store.apply({
      type: 'song.import',
      draft: {title: '새 찬양', slides: [opening, verse, closing]},
      target: {kind: 'new'},
    });

    expect(result.ok).toBe(true);
    const id = result.ok ? result.value.id : '';
    const {label: _label, ...title} = opening;
    expect(store.song(id)?.song).toMatchObject({
      titleSlide: title,
      slides: [verse],
    });
  });
});
