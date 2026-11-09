import {fixtureSlideId} from '@fixtures/core/songs/slideFixtures';
import {SUNDAY_NOTICE_PICTURE_ID} from '@core/themes/sundayNotice';
import * as v from 'valibot';
import {describe, expect, it} from 'vitest';
import type {Result} from '@core/common/result';
import type {MediaChoice} from '@core/live/state';
import type {FileError, LoadedFile} from '@core/schema/fileFormat';
import type {Label} from '@core/schema/labels';
import {mediaListSchema} from '@core/schema/mediaList';
import {parseService, serviceSchema, type Service} from '@core/schema/service';
import {DEFAULT_LABELS} from '@main/store/defaults';
import {
  buildShowService,
  projectSongTiles,
  SHOW_SERVICE_LIMITS,
  songTiles,
} from '@main/store/showService';
import {
  HYMN_ONE_ID,
  hymnOne,
  itemId,
  service,
  SUNDAY_ID,
} from '@fixtures/main/store/testFiles';

import {parseSong, type Song} from '@core/schema/song';
import type {ServicePassages} from '@main/bible/servicePassages';
import {createThemeId, translationIdSchema} from '@core/schema/ids';
import {slidesItem, SLIDES_ITEM} from '@fixtures/core/slides';
import {MOCK_LONG_VERSE} from '@fixtures/core/bibleSplit';
import {
  slidesBibleItem,
  slidesBiblePassages,
  VERSE_SLIDE,
} from '@fixtures/core/slidesBible';

const MISSING_SONG_ID = '0f0f0f0f-0f0f-4f0f-8f0f-0f0f0f0f0f0f';
const MEDIA_ID = '3b9d0c52-7e1f-4a2b-8c3d-4e5f60718293';

it.each(['song default', 'song override', 'slides'] as const)(
  'only warns for a missing referenced background in %s',
  source => {
    for (const state of ['none', 'builtin', 'missing'] as const) {
      const id = SUNDAY_NOTICE_PICTURE_ID;
      const reference = state === 'none' ? {} : {background: id};
      const deck = loadedSong({
        ...hymnOne(),
        ...(source === 'song default' ? reference : {}),
      });
      const item =
        source === 'slides'
          ? {
              ...slidesItem(),
              slides: {
                ...slidesItem().slides,
                slides: slidesItem().slides.slides.filter(
                  slide => 'text' in slide,
                ),
              },
              ...reference,
            }
          : {
              id: itemId(1),
              song: HYMN_ONE_ID,
              slides: deck.data.slides,
              ...(source === 'song override' ? reference : {}),
            };
      const shown = buildShowService({
        service: loadedService([item]),
        songs: new Map([[HYMN_ONE_ID, deck]]),
        labels: [],
        revision: 1,
        backgrounds:
          state === 'builtin'
            ? new Map([[id, {mediaId: id, loop: false}]])
            : new Map(),
        media:
          state === 'missing'
            ? new Map([
                [
                  id,
                  {
                    id,
                    name: 'Warm light',
                    kind: 'image',
                    file: 'gone.png',
                    size: 1,
                  },
                ],
              ])
            : new Map(),
      });
      if (state === 'missing') {
        expect(shown.rows[0]).toMatchObject({
          problem: 'missing-background',
          missingBackgroundName: 'Warm light',
        });
      } else {
        expect(shown.rows[0]).not.toHaveProperty('problem');
        expect(shown.rows[0]).not.toHaveProperty('missingBackgroundName');
      }
    }
  },
);

it('projects a song title marker without inventing a transition', () => {
  const song = loaded(parseSong(JSON.stringify(hymnOne()), 'song.llsong')).data;
  const tiles = projectSongTiles(
    {
      ...song,
      slides: [
        {
          id: fixtureSlideId(1),
          titleSlide: true,
          titleLayout: {titleTracking: 12, subtitleTracking: 12},
          lines: ['Title', 'Subtitle'],
        },
      ],
    },
    new Map(),
  ).tiles;
  expect(tiles[0]).toMatchObject({
    titleSlide: true,
    titleLayout: {titleTracking: 12, subtitleTracking: 12},
    lines: ['Title', 'Subtitle'],
  });
  expect(tiles[0]?.transition).toBeUndefined();
});

function loaded<T>(parsed: Result<LoadedFile<T>, FileError>): LoadedFile<T> {
  if (!parsed.ok) {
    throw new Error(parsed.error.message);
  }
  return parsed.value;
}

function loadedSong(json: object): LoadedFile<Song> {
  return loaded(parseSong(JSON.stringify(json), 'song.llsong'));
}

function loadedService(
  order: readonly object[],
  schemaVersion = 1,
): LoadedFile<Service> {
  const json = {
    ...service(SUNDAY_ID, '2026-11-01T11:00', order),
    schemaVersion,
  };
  return loaded(parseService(JSON.stringify(json), 'service.llservice'));
}

function build(
  order: readonly object[],
  labels: readonly Label[] = DEFAULT_LABELS,
) {
  return buildShowService({
    service: loadedService(order),
    songs: new Map([[HYMN_ONE_ID, loadedSong(hymnOne())]]),
    labels,
    revision: 3,
  });
}

describe('buildShowService', () => {
  it('carries checked verse text and a source revision without losing a missing-verse warning', () => {
    const item = slidesBibleItem();
    const shown = buildShowService({
      service: loadedService([item]),
      serviceRevision: 7,
      songs: new Map(),
      labels: [],
      revision: 3,
      passages: {
        tiles: new Map(),
        references: new Map(),
        unavailable: new Set([item.id]),
        slides: new Map([[item.id, slidesBiblePassages(item)]]),
      },
      media: new Map(),
    });
    expect(shown.rows[0]).toMatchObject({kind: 'slides', sourceRevision: 7});
    expect(
      shown.tiles[item.id]?.find(tile => tile.sourceSlideId === VERSE_SLIDE),
    ).toMatchObject({
      verse: {reference: {book: 43, verse: 16}, text: MOCK_LONG_VERSE},
    });
    const withoutPicture = {
      ...item,
      slides: {
        ...item.slides,
        slides: item.slides.slides.filter(slide => !('media' in slide)),
      },
    };
    const unavailable = buildShowService({
      service: loadedService([withoutPicture]),
      songs: new Map(),
      labels: [],
      revision: 1,
      passages: {
        tiles: new Map(),
        references: new Map(),
        unavailable: new Set([item.id]),
      },
    });
    expect(unavailable.rows[0]).toHaveProperty('problem', 'missing-bible');
  });
  it('projects slides items into named rows and navigable text and picture tiles', () => {
    const shown = build([slidesItem()]);
    expect(shown.rows[0]).toMatchObject({
      kind: 'slides',
      form: 'ad',
      title: 'Invented slides',
    });
    expect(shown.tiles[SLIDES_ITEM]).toHaveLength(3);
    expect(shown.tiles[SLIDES_ITEM]?.[0]).toMatchObject({
      name: 'Meeting',
      lines: ['First line\nSecond line'],
    });
    expect(shown.rows[0]).toHaveProperty('problem', 'missing-media');
  });
  it('projects both slides forms with their editable item names', () => {
    const projected = build(
      ['blank', 'ad'].map((form, index) => ({
        id: itemId(index + 1),
        slides: {form, name: `Slides ${index}`, slides: []},
      })),
    );
    expect(
      projected.rows.map(row => ({kind: row.kind, title: row.title})),
    ).toEqual([
      {kind: 'slides', title: 'Slides 0'},
      {kind: 'slides', title: 'Slides 1'},
    ]);
  });
  it.each([true, false])(
    'shows the resolved Bible passage with the numbering %s of its item',
    verseNumbers => {
      const document = loadedService(
        ['John 3 : 16 - 18', '시편 1:1'].map((ref, index) => ({
          id: itemId(index + 1),
          theme: itemId(50),
          bible: {
            translation: 'sample',
            ref,
            split: 'verse',
            reference: 'every',
            verseNumbers,
            translationName: !verseNumbers,
          },
        })),
      );
      const tiles = [
        {label: '3:16', labelColor: 'none', lines: ['구절']},
      ] as const;
      const passages: ServicePassages = {
        tiles: new Map([[itemId(1), tiles]]),
        references: new Map([
          [
            itemId(1),
            {
              ref: '요한복음 3:16-18',
              translation: v.parse(translationIdSchema, 'sample'),
              passage: {
                translation: v.parse(translationIdSchema, 'sample'),
                ref: '요한복음 3:16-18',
                displayRef: '요한복음 3:16~18',
                verses: [{chapter: 3, verse: 16, text: '가나 다라'}],
              },
            },
          ],
        ]),
        unavailable: new Set([itemId(2)]),
      };

      const show = buildShowService({
        service: document,
        songs: new Map(),
        labels: [],
        revision: 1,
        passages,
      });

      expect(show.rows[0]).toMatchObject({
        id: itemId(1),
        title: 'John 3 : 16 - 18',
        bible: {
          ref: '요한복음 3:16-18',
          translation: 'sample',
          verseNumbers,
          translationName: !verseNumbers,
          reference: 'every',
          theme: itemId(50),
          passage: {verses: [{chapter: 3, verse: 16, text: '가나 다라'}]},
        },
      });
      expect(show.tiles[itemId(1)]).toBe(tiles);
      expect(show.rows[1]).toMatchObject({problem: 'missing-bible'});
      expect(show.rows[1]).not.toHaveProperty('bible');
    },
  );

  it('resolves the item override before the song default without fallback', () => {
    const defaultMedia = {mediaId: MEDIA_ID, loop: true};
    const override = {mediaId: itemId(99), loop: false};
    const backgrounds = new Map<string, MediaChoice>([
      [MEDIA_ID, defaultMedia],
      [override.mediaId, override],
    ]);
    const project = () =>
      buildShowService({
        service: loadedService([
          {
            slides: loadedSong(hymnOne()).data.slides,
            id: itemId(1),
            song: HYMN_ONE_ID,
          },
          {
            slides: loadedSong(hymnOne()).data.slides,
            id: itemId(2),
            song: HYMN_ONE_ID,
            background: override.mediaId,
            theme: itemId(50),
          },
        ]),
        songs: new Map([
          [HYMN_ONE_ID, loadedSong({...hymnOne(), background: MEDIA_ID})],
        ]),
        labels: [],
        backgrounds,
        revision: 1,
      });

    expect(project().rows).toMatchObject([
      {background: defaultMedia},
      {background: override, theme: itemId(50)},
    ]);
    backgrounds.delete(override.mediaId);
    const missing = project().rows[1];
    expect(missing).toMatchObject({problem: 'missing-background'});
    expect(missing).not.toHaveProperty('background');
  });

  it('marks an unavailable default without removing the lyrics', () => {
    const show = buildShowService({
      service: loadedService([
        {
          slides: loadedSong(hymnOne()).data.slides,
          id: itemId(1),
          song: HYMN_ONE_ID,
        },
      ]),
      songs: new Map([
        [HYMN_ONE_ID, loadedSong({...hymnOne(), background: MEDIA_ID})],
      ]),
      labels: [],
      revision: 1,
    });
    expect(show.rows[0]).toMatchObject({problem: 'missing-background'});
    expect(show.rows[0]).not.toHaveProperty('background');
    expect(show.tiles[itemId(1)]).toHaveLength(3);
  });

  it('makes a row for each item with the item id', () => {
    const show = build([
      {id: itemId(1), header: '찬양'},
      {
        slides: loadedSong(hymnOne()).data.slides,
        id: itemId(2),
        song: HYMN_ONE_ID,
      },
      {id: itemId(3), header: '찬양'},
      {
        id: itemId(4),
        bible: {
          translation: 'krv',
          ref: '요한복음 3:16-18',
          split: 'verse',
          reference: 'every',
          verseNumbers: true,
          translationName: false,
        },
      },
      {id: itemId(5), media: MEDIA_ID},
      {id: itemId(7), scripture: {page: 3}},
      {
        slides: loadedSong(hymnOne()).data.slides,
        id: itemId(8),
        song: MISSING_SONG_ID,
      },
    ]);

    expect(show).toMatchObject({
      revision: 3,
      id: SUNDAY_ID,
      name: '주일 예배',
      readOnly: false,
    });
    expect(show.rows).toEqual([
      {kind: 'header', id: itemId(1), title: '찬양'},
      {kind: 'song', id: itemId(2), title: '만복의 근원 하나님'},
      {kind: 'header', id: itemId(3), title: '찬양'},
      {kind: 'bible', id: itemId(4), title: '요한복음 3:16-18'},
      {kind: 'media', id: itemId(5), title: ''},
      {kind: 'unknown', id: itemId(7), title: '', problem: 'unknown-kind'},
      {kind: 'song', id: itemId(8), title: '', problem: 'missing-song'},
    ]);
    expect(Object.keys(show.tiles)).toEqual([itemId(2), itemId(8)]);
  });

  it('shows files from a newer app version as read-only', () => {
    const show = buildShowService({
      service: loadedService(
        [
          {
            slides: loadedSong(hymnOne()).data.slides,
            id: itemId(1),
            song: HYMN_ONE_ID,
          },
        ],
        99,
      ),
      songs: new Map([
        [HYMN_ONE_ID, loadedSong({...hymnOne(), schemaVersion: 99})],
      ]),
      labels: DEFAULT_LABELS,
      revision: 1,
    });

    expect(show.readOnly).toBe(true);
    expect(show.rows).toEqual([
      {
        kind: 'song',
        id: itemId(1),
        title: '만복의 근원 하나님',
        problem: 'newer-version',
      },
    ]);
    expect(show.tiles[itemId(1)]).toHaveLength(3);
  });

  it('gives a song the tiles of its default order with 이름표 colors', () => {
    const show = build([
      {
        slides: loadedSong(hymnOne()).data.slides,
        id: itemId(1),
        song: HYMN_ONE_ID,
      },
    ]);

    expect(show.tiles[itemId(1)]).toMatchObject([
      {
        label: '1절',
        labelColor: '#5FB8C2',
        lines: ['만복의 근원 하나님', '온 백성 찬송 드리고'],
        sourceSlide: {slideId: fixtureSlideId(1)},
      },
      {
        label: '후렴',
        labelColor: '#D6B35F',
        lines: ['저 천사여 찬송하세', '찬송 성부 성자 성령'],
      },
      {label: null, labelColor: 'none', lines: ['아멘']},
    ]);
  });

  it('gives a 이름표 that is not in the list no color', () => {
    const show = build(
      [
        {
          slides: loadedSong(hymnOne()).data.slides,
          id: itemId(1),
          song: HYMN_ONE_ID,
        },
      ],
      [{name: '1절', color: '#D07A8A', key: null}],
    );

    expect(show.tiles[itemId(1)]?.map(({labelColor}) => labelColor)).toEqual([
      '#D07A8A',
      'none',
      'none',
    ]);
  });

  it('maps each jump key to its 이름표, and the first wins a shared key', () => {
    const show = build(
      [],
      [
        {name: '1절', color: '#5FB8C2', key: 'Digit1'},
        {name: '후렴', color: '#D6B35F', key: 'KeyC'},
        {name: '브리지', color: '#A99AE0', key: 'KeyC'},
        {name: '간주', color: '#A3A3A3', key: null},
      ],
    );

    expect(show.jumpKeys).toEqual({Digit1: '1절', KeyC: '후렴'});
  });

  it('reads the item deck even after the library changes or disappears', () => {
    const deck = loadedSong(hymnOne()).data.slides.map(slide => ({
      ...slide,
      lines: ['Item lyric'],
    }));
    const source = loadedService([
      {id: itemId(1), song: HYMN_ONE_ID, slides: deck},
    ]);
    for (const songs of [
      new Map([[HYMN_ONE_ID, loadedSong(hymnOne())]]),
      new Map<string, LoadedFile<Song>>(),
    ]) {
      const show = buildShowService({
        service: source,
        songs,
        labels: [],
        revision: 1,
      });
      expect(show.tiles[itemId(1)]?.map(tile => tile.lines)).toEqual(
        deck.map(slide => slide.lines),
      );
      expect(show.tiles[itemId(1)]?.[0]?.sourceSlide).toEqual({
        songId: HYMN_ONE_ID,
        slideId: deck[0]?.id,
      });
    }
  });
  it('keeps repeated labels and distinct slide hot keys without grouping', () => {
    const song = loadedSong(hymnOne()).data;
    const deck = {
      ...song,
      slides: [
        {
          id: fixtureSlideId(1),
          label: '후렴',
          lines: ['First'],
          hotKey: 'KeyA',
        },
        {
          id: fixtureSlideId(2),
          label: '후렴',
          lines: ['Second'],
          hotKey: 'KeyB',
        },
        {id: fixtureSlideId(3), lines: ['No label']},
      ],
    };
    expect(songTiles(deck, new Map([['후렴', '#5FB8C2']]))).toEqual([
      {
        label: '후렴',
        labelColor: '#5FB8C2',
        lines: ['First'],
        hotKey: 'KeyA',
        sourceSlide: {songId: song.id, slideId: fixtureSlideId(1)},
      },
      {
        label: '후렴',
        labelColor: '#5FB8C2',
        lines: ['Second'],
        hotKey: 'KeyB',
        sourceSlide: {songId: song.id, slideId: fixtureSlideId(2)},
      },
      {
        label: null,
        labelColor: 'none',
        lines: ['No label'],
        sourceSlide: {songId: song.id, slideId: fixtureSlideId(3)},
      },
    ]);
  });
  it('projects an empty item and bounds the projection without partial output', () => {
    const song = loadedSong(hymnOne()).data;
    const slides = Array.from(
      {length: SHOW_SERVICE_LIMITS.tiles},
      (_, index) => ({id: fixtureSlideId(index), lines: []}),
    );
    expect(projectSongTiles({...song, slides: []}, new Map())).toEqual({
      tiles: [],
      capped: false,
    });
    expect(projectSongTiles({...song, slides}, new Map()).tiles).toHaveLength(
      10_000,
    );
    expect(
      projectSongTiles(
        {...song, slides: [...slides, {id: fixtureSlideId(10001), lines: []}]},
        new Map(),
      ),
    ).toEqual({tiles: [], capped: true});
  });
});

describe('buildShowService media items', () => {
  const IMAGE_ID = '7d1c2b3a-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
  const AUDIO_ID = '8e2d3c4b-5f60-4b7c-9d8e-0f1a2b3c4d5e';
  const OTHER_IMAGE_ID = '9f3e4d5c-6071-4c8d-8e9f-1a2b3c4d5e6f';
  const items = new Map(
    v
      .parse(mediaListSchema, {
        format: 'llmedia',
        schemaVersion: 1,
        items: [
          {id: IMAGE_ID, name: '광고 배경', kind: 'image'},
          {id: AUDIO_ID, name: '전주', kind: 'audio'},
          {id: OTHER_IMAGE_ID, name: '', kind: 'image'},
        ].map(item => ({...item, file: `${item.id}.bin`, size: 1})),
        playlists: [],
        audioPlaylists: [],
      })
      .items.map(item => [item.id, item]),
  );
  const choice: MediaChoice = {mediaId: IMAGE_ID, loop: false};

  function buildOthers(order: readonly object[], withBackground = true) {
    return buildShowService({
      service: loadedService(order),
      songs: new Map(),
      labels: DEFAULT_LABELS,
      revision: 1,
      backgrounds: new Map(withBackground ? [[IMAGE_ID, choice]] : []),
      media: items,
    });
  }

  it('names the rows by the media, as 준비 does', () => {
    const show = buildOthers([
      {id: itemId(1), media: IMAGE_ID},
      {id: itemId(2), media: OTHER_IMAGE_ID},
    ]);
    expect(show.rows.map(row => row.title)).toEqual([
      '광고 배경',
      '이름 없는 미디어',
    ]);
  });

  it('gives a media item one tile that outputs the media', () => {
    const show = buildOthers([{id: itemId(1), media: IMAGE_ID}]);
    expect(show.rows).toEqual([
      {kind: 'media', id: itemId(1), title: '광고 배경'},
    ]);
    expect(show.tiles[itemId(1)]).toEqual([
      {label: null, labelColor: 'none', lines: ['광고 배경'], media: choice},
    ]);
  });

  it('warns about a media file that is gone, without a tile', () => {
    const show = buildOthers(
      [
        {id: itemId(1), media: IMAGE_ID},
        {id: itemId(3), media: AUDIO_ID},
      ],
      false,
    );
    expect(show.rows).toEqual([
      {
        kind: 'media',
        id: itemId(1),
        title: '광고 배경',
        problem: 'missing-media',
      },
      {kind: 'media', id: itemId(3), title: '전주'},
    ]);
    expect(show.tiles).toEqual({
      [itemId(1)]: [],
      [itemId(3)]: [],
    });
  });
});

it('projects the card ahead of song and slide content without changing their theme', () => {
  const theme = createThemeId('00000000-0000-4000-8000-000000000111');
  const sectionCard = {name: '사도신경', english: "Apostle's Creed", theme};
  const song = loadedSong(hymnOne());
  for (const item of [
    {id: itemId(1), song: HYMN_ONE_ID, slides: song.data.slides, sectionCard},
    {...slidesItem(), sectionCard},
  ]) {
    const shown = buildShowService({
      service: loadedService([item]),
      songs: new Map([[HYMN_ONE_ID, song]]),
      labels: [],
      revision: 1,
    });
    expect(shown.tiles[item.id]?.[0]).toMatchObject({
      sectionCard,
      lines: [sectionCard.english],
    });
    expect(shown.tiles[item.id]?.length).toBeGreaterThan(1);
    expect(shown.rows[0]).not.toHaveProperty('theme', theme);
  }
});

it('keeps a Bible card before the resolved verses and rejects invalid cards', () => {
  const card = {
    name: 'Section',
    english: 'Section',
    theme: createThemeId('00000000-0000-4000-8000-000000000111'),
  };
  const item = {
    id: itemId(1),
    bible: {
      translation: 'sample',
      ref: 'John 3:16',
      split: 'verse',
      reference: 'every',
      verseNumbers: true,
      translationName: false,
    },
    sectionCard: card,
  };
  const verse = {label: '3:16', labelColor: 'none' as const, lines: ['Verse']};
  const passages: ServicePassages = {
    tiles: new Map([[item.id, [verse]]]),
    references: new Map(),
    unavailable: new Set(),
  };
  const show = buildShowService({
    service: loadedService([item]),
    songs: new Map(),
    labels: [],
    revision: 1,
    passages,
  });
  expect(show.tiles[item.id]).toMatchObject([
    {sectionCard: card},
    {label: '3:16', lines: ['Verse']},
  ]);
  expect(
    v.safeParse(serviceSchema, {
      ...service(SUNDAY_ID, '2026-11-01T11:00', []),
      order: [{...item, sectionCard: {...card, name: ' '}}],
    }).success,
  ).toBe(false);
});

it('reports the Bible tile limit when its opening card would exceed it', () => {
  const card = {
    name: 'Section',
    english: 'Section',
    theme: createThemeId('00000000-0000-4000-8000-000000000111'),
  };
  const item = {
    id: itemId(1),
    bible: {
      translation: 'sample',
      ref: 'John 3:16',
      split: 'verse',
      reference: 'every',
      verseNumbers: true,
      translationName: false,
    },
    sectionCard: card,
  };
  const verse = {label: '3:16', labelColor: 'none' as const, lines: ['Verse']};
  const passages: ServicePassages = {
    tiles: new Map([
      [item.id, Array.from({length: SHOW_SERVICE_LIMITS.tiles}, () => verse)],
    ]),
    references: new Map(),
    unavailable: new Set(),
  };
  const show = buildShowService({
    service: loadedService([item]),
    songs: new Map(),
    labels: [],
    revision: 1,
    passages,
  });
  expect(show.rows[0]).toMatchObject({problem: 'tile-limit'});
  const unavailable = buildShowService({
    service: loadedService([item]),
    songs: new Map(),
    labels: [],
    revision: 1,
    passages: {...passages, unavailable: new Set([item.id])},
  });
  expect(unavailable.rows[0]).toMatchObject({problem: 'tile-limit'});
  expect(show.tiles[item.id]).toEqual([]);
});
