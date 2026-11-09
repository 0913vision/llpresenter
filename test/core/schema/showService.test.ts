import {describe, expect, it} from 'vitest';
import {parseShowService, SHOW_SERVICE_LIMITS} from '@core/schema/showService';
import {BIBLE_LOOKUP_LIMITS} from '@core/schema/bibleLookup';

function showService() {
  return {
    revision: 2,
    id: 'service-1',
    name: '주일 예배',
    readOnly: false,
    rows: [
      {kind: 'header', id: 'item-1', title: '찬양'},
      {kind: 'song', id: 'item-2', title: '만복의 근원 하나님'},
      {kind: 'song', id: 'item-3', title: '', problem: 'missing-song'},
      {kind: 'unknown', id: 'item-4', title: '', problem: 'unknown-kind'},
      {kind: 'song', id: 'item-5', title: '새 버전', problem: 'newer-version'},
    ],
    tiles: {
      'item-2': [
        {label: '1절', labelColor: '#5FB8C2', lines: ['만복의 근원 하나님']},
        {label: null, labelColor: 'none', lines: []},
      ],
    },
    jumpKeys: {KeyC: '후렴'},
  };
}

it('accepts an optional song theme and rejects malformed theme identities', () => {
  const value = showService();
  const row = {kind: 'song', id: 'themed-song', title: 'Theme sample'};
  expect(
    parseShowService({
      ...value,
      rows: [{...row, theme: '00000000-0000-4000-8000-000000000501'}],
    }).ok,
  ).toBe(true);
  for (const theme of ['bad-id', null, 12]) {
    expect(parseShowService({...value, rows: [{...row, theme}]}).ok).toBe(
      false,
    );
  }
});

describe('parseShowService', () => {
  it('preserves bounded title layout on projected tiles', () => {
    const titleLayout = {
      titleTracking: 12,
      subtitleTracking: 12,
      subtitleTop: 338,
    };
    const value = showService();
    const withLayout = (layout: unknown) => ({
      ...value,
      tiles: {
        'item-2': [
          {
            label: null,
            labelColor: 'none',
            lines: ['Title'],
            titleSlide: true,
            titleLayout: layout,
          },
        ],
      },
    });
    expect(parseShowService(withLayout(titleLayout))).toMatchObject({
      ok: true,
      value: {tiles: {'item-2': [{titleLayout}]}},
    });
    expect(
      parseShowService(withLayout({...titleLayout, titleTracking: 201})).ok,
    ).toBe(false);
  });
  it('validates the title marker on projected song tiles', () => {
    const value = showService();
    for (const titleSlide of [true, false, 'title', null]) {
      expect(
        parseShowService({
          ...value,
          tiles: {
            'item-2': [
              {label: null, labelColor: 'none', lines: ['Title'], titleSlide},
            ],
          },
        }).ok,
      ).toBe(titleSlide === true);
    }
  });
  it('checks resolved verse slots and caps source text and reference counts', () => {
    const tile = {
      label: '3:16',
      labelColor: 'none',
      lines: [],
      kind: 'blank',
      sourceSlideId: '00000000-0000-4000-8000-000000000911',
      verse: {
        reference: {translation: 'sample', book: 43, chapter: 3, verse: 16},
        text: '가'.repeat(20_000),
      },
    };
    const value = {...showService(), tiles: {slides: [tile]}};
    expect(parseShowService(value)).toMatchObject({
      ok: true,
      value: {
        tiles: {
          slides: [{sourceSlideId: tile.sourceSlideId, verse: tile.verse}],
        },
      },
    });
    for (const patch of [
      {sourceSlideId: 'bad-id'},
      {verse: {...tile.verse, text: '가'.repeat(20_001)}},
      {verse: {...tile.verse, reference: {...tile.verse.reference, book: 67}}},
      {
        verse: {
          ...tile.verse,
          reference: {...tile.verse.reference, chapter: 151},
        },
      },
      {verse: {...tile.verse, reference: {...tile.verse.reference, verse: 0}}},
    ]) {
      expect(
        parseShowService({...value, tiles: {slides: [{...tile, ...patch}]}}).ok,
      ).toBe(false);
    }
    const small = {...tile, verse: {...tile.verse, text: '가'}};
    expect(
      parseShowService({
        ...value,
        tiles: {slides: Array.from({length: 200}, () => small)},
      }).ok,
    ).toBe(true);
    expect(
      parseShowService({
        ...value,
        tiles: {slides: Array.from({length: 201}, () => small)},
      }).ok,
    ).toBe(false);
  });

  it('accepts checked source passages and rejects invalid split metadata', () => {
    const passage = {
      translation: 'sample',
      ref: '요한복음 3:16',
      displayRef: '요한복음 3:16',
      verses: [{chapter: 3, verse: 16, text: '가나 다라'}],
    };
    const bible = {
      translation: passage.translation,
      ref: passage.ref,
      passage,
      reference: 'every',
    };
    const value = {
      ...showService(),
      rows: [{kind: 'bible', id: 'bible', title: passage.ref, bible}],
      tiles: {
        bible: [
          {
            label: '3:16',
            labelColor: 'none',
            lines: ['가나 (계속)'],
            continued: true,
            biblePart: 1,
          },
        ],
      },
    };
    expect(parseShowService(value)).toMatchObject({
      ok: true,
      value: {
        rows: [{bible}],
        tiles: {bible: [{continued: true, biblePart: 1}]},
      },
    });
    for (const patch of [
      {theme: 'bad-id'},
      {reference: 'sometimes'},
      {passage: {...passage, translation: 'other'}},
      {passage: {...passage, ref: '요한복음 3:17'}},
      {passage: {...passage, verses: [{chapter: 0, verse: 16, text: '가나'}]}},
    ]) {
      expect(
        parseShowService({
          ...value,
          rows: [{...value.rows[0], bible: {...bible, ...patch}}],
        }).ok,
      ).toBe(false);
    }
    expect(
      parseShowService({
        ...value,
        tiles: {bible: [{...value.tiles.bible[0], continued: 'true'}]},
      }).ok,
    ).toBe(false);
    for (const biblePart of [0, -1, 1.5, 10_001, '1', null]) {
      expect(
        parseShowService({
          ...value,
          tiles: {bible: [{...value.tiles.bible[0], biblePart}]},
        }).ok,
      ).toBe(false);
    }
  });
  it('accepts slide rows, names, and picture tiles and rejects malformed fields', () => {
    const picture = '00000000-0000-4000-8000-000000000901';
    const row = {kind: 'slides', id: 'slides', title: 'Invented', form: 'ad'};
    const tile = {
      label: 'Meeting',
      labelColor: 'none',
      lines: [],
      name: 'Meeting',
      picture,
      kind: 'ad',
    };
    const value = {...showService(), rows: [row], tiles: {slides: [tile]}};
    expect(parseShowService(value)).toMatchObject({
      ok: true,
      value: {rows: [row], tiles: {slides: [tile]}},
    });
    for (const changes of [
      {picture: 'bad-id'},
      {name: 'x'.repeat(4001)},
      {kind: 'other'},
    ]) {
      expect(
        parseShowService({...value, tiles: {slides: [{...tile, ...changes}]}})
          .ok,
      ).toBe(false);
    }
    expect(
      parseShowService({...value, rows: [{...row, form: 'other'}]}).ok,
    ).toBe(false);
  });
  it.each([true, false, undefined])(
    'retains optional saved translation visibility %s',
    translationName => {
      const bible = {
        ref: '요한복음 3:16',
        translation: 'sample',
        ...(translationName === undefined ? {} : {translationName}),
      };
      expect(
        parseShowService({
          ...showService(),
          rows: [{kind: 'bible', id: 'saved', title: '', bible}],
        }),
      ).toMatchObject({ok: true, value: {rows: [{bible}]}});
    },
  );

  it.each([null, 'false', 0])(
    'rejects invalid saved translation visibility %j',
    translationName => {
      expect(
        parseShowService({
          ...showService(),
          rows: [
            {
              kind: 'bible',
              id: 'saved',
              title: '',
              bible: {
                ref: '요한복음 3:16',
                translation: 'sample',
                translationName,
              },
            },
          ],
        }).ok,
      ).toBe(false);
    },
  );
  it.each([true, false])('retains saved Bible numbering %s', verseNumbers => {
    const bible = {
      ref: '요한복음 3:16-18',
      translation: 'sample',
      verseNumbers,
    };
    expect(
      parseShowService({
        ...showService(),
        rows: [{kind: 'bible', id: 'saved', title: '', bible}],
      }),
    ).toMatchObject({
      ok: true,
      value: {rows: [{bible}]},
    });
  });

  it.each([null, 'false', 0])(
    'rejects invalid saved Bible numbering %j',
    verseNumbers => {
      expect(
        parseShowService({
          ...showService(),
          rows: [
            {
              kind: 'bible',
              id: 'saved',
              title: '',
              bible: {
                ref: '요한복음 3:16-18',
                translation: 'sample',
                verseNumbers,
              },
            },
          ],
        }).ok,
      ).toBe(false);
    },
  );
  it('retains a Bible reference on a projected tile', () => {
    const tile = {
      label: '3:16',
      labelColor: 'none',
      lines: ['Invented'],
      reference: '3:16',
    };
    expect(
      parseShowService({...showService(), tiles: {bible: [tile]}}),
    ).toMatchObject({
      ok: true,
      value: {tiles: {bible: [tile]}},
    });
  });
  it('keeps optional Bible identity only on Bible rows and strips unrelated fields', () => {
    const bible = {ref: '요한복음 3:16-18', translation: 'sample'};
    const row = {kind: 'bible', id: 'saved', title: 'Stored reference'};
    const song = {kind: 'song', id: 'song', title: 'Invented song'};
    expect(
      parseShowService({
        ...showService(),
        rows: [
          row,
          {...row, id: 'resolved', bible: {...bible, verses: []}},
          {...song, bible},
        ],
      }),
    ).toMatchObject({
      ok: true,
      value: {rows: [row, {...row, id: 'resolved', bible}, song]},
    });
  });

  it.each([
    null,
    {ref: '', translation: 'sample'},
    {ref: '   ', translation: 'sample'},
    {ref: 'Invented', translation: ''},
    {ref: 3, translation: 'sample'},
    {ref: 'Invented', translation: 3},
    {ref: 'x'.repeat(BIBLE_LOOKUP_LIMITS.input + 1), translation: 'sample'},
    {
      ref: 'Invented',
      translation: 'x'.repeat(BIBLE_LOOKUP_LIMITS.translationId + 1),
    },
  ])('rejects malformed or oversized saved Bible identity %j', bible => {
    expect(
      parseShowService({
        ...showService(),
        rows: [{kind: 'bible', id: 'saved', title: '', bible}],
      }).ok,
    ).toBe(false);
  });

  it('accepts saved Bible identity at the reference and translation limits', () => {
    const bible = {
      ref: 'x'.repeat(BIBLE_LOOKUP_LIMITS.input),
      translation: 'x'.repeat(BIBLE_LOOKUP_LIMITS.translationId),
    };
    expect(
      parseShowService({
        ...showService(),
        rows: [{kind: 'bible', id: 'saved', title: '', bible}],
      }).ok,
    ).toBe(true);
  });

  it('retains an unavailable saved Bible warning without accepting an unknown problem', () => {
    const row = {
      kind: 'bible',
      id: 'passage',
      title: 'Invented reference',
      problem: 'missing-bible',
    };
    expect(parseShowService({...showService(), rows: [row]})).toMatchObject({
      ok: true,
      value: {rows: [row]},
    });
    expect(
      parseShowService({
        ...showService(),
        rows: [{...row, problem: 'missing-anything'}],
      }).ok,
    ).toBe(false);
  });

  it('keeps the media of a media tile', () => {
    const tiles = [
      {
        label: null,
        labelColor: 'none',
        lines: ['카운트다운'],
        media: {mediaId: '3b9d0c52-7e1f-4a2b-8c3d-4e5f60718293', loop: true},
      },
    ];
    const parsed = parseShowService({
      ...showService(),
      tiles: {'item-2': tiles},
    });
    expect(parsed.ok && parsed.value?.tiles['item-2']).toEqual(tiles);
  });

  it('keeps the source slide and hot key of a tile', () => {
    const sourceSlide = {
      songId: '00000000-0000-4000-8000-000000000001',
      slideId: '00000000-0000-4000-8000-000000000002',
    };
    const tiles = [
      {
        label: '후렴',
        labelColor: 'none',
        lines: ['아멘'],
        hotKey: 'KeyA',
        sourceSlide,
      },
      {label: null, labelColor: 'none', lines: [], sourceSlide},
      {label: null, labelColor: 'none', lines: []},
    ];
    const parsed = parseShowService({
      ...showService(),
      tiles: {'item-2': tiles},
    });
    expect(parsed.ok && parsed.value?.tiles['item-2']).toEqual(tiles);
  });

  it.each([
    {hotKey: 'KeyA'},
    {
      hotKey: 'Numpad0',
      sourceSlide: {
        songId: '00000000-0000-4000-8000-000000000001',
        slideId: '00000000-0000-4000-8000-000000000002',
      },
    },
    {hotKey: null},
    {
      sourceSlide: {
        songId: '00000000-0000-4000-8000-000000000001',
        slideId: -1,
      },
    },
    {
      sourceSlide: {
        songId: '00000000-0000-4000-8000-000000000001',
        slideId: null,
      },
    },
    {
      sourceSlide: {
        songId: 'invalid',
        slideId: '00000000-0000-4000-8000-000000000002',
      },
    },
    {
      sourceSlide: {
        songId: '00000000-0000-4000-8000-000000000001',
        slideId: 'invalid',
      },
    },
  ])('rejects malformed tile metadata %j', metadata => {
    const tile = {label: null, labelColor: 'none', lines: [], ...metadata};
    expect(
      parseShowService({...showService(), tiles: {'item-2': [tile]}}).ok,
    ).toBe(false);
  });

  it('accepts a service and no service', () => {
    expect(parseShowService(showService())).toEqual({
      ok: true,
      value: showService(),
    });
    expect(parseShowService(null)).toEqual({ok: true, value: null});
  });

  it('keeps an optional background only on song rows', () => {
    const background = {mediaId: 'media-1', loop: true};
    const song = {kind: 'song', id: 'song', title: 'Song', background};
    const bible = {kind: 'bible', id: 'bible', title: 'Passage'};
    expect(
      parseShowService({
        ...showService(),
        rows: [song, {...bible, background}],
      }),
    ).toMatchObject({ok: true, value: {rows: [song, bible]}});
  });

  it.each([
    [{mediaId: '', loop: true}, 'mediaId'],
    [{mediaId: 3, loop: true}, 'mediaId'],
    [{mediaId: 'media-1'}, 'loop'],
    [{mediaId: 'media-1', loop: 'true'}, 'loop'],
    [null, ''],
  ])('rejects a malformed song background %j', (background, field) => {
    const result = parseShowService({
      ...showService(),
      rows: [{kind: 'song', id: 'song', title: '', background}],
    });
    expect(result.ok ? null : result.error.field).toBe(
      `rows.0.background${field === '' ? '' : `.${field}`}`,
    );
  });

  it.each([
    [
      'an unknown row kind',
      {rows: [{kind: 'video', id: 'x', title: ''}]},
      'rows.0.kind',
    ],
    [
      'a header with a problem field that is dropped',
      {rows: [{kind: 'header', id: 'x', title: 't', problem: 'missing-song'}]},
      null,
    ],
    [
      'an unknown problem',
      {rows: [{kind: 'song', id: 'x', title: '', problem: 'broken'}]},
      'rows.0.problem',
    ],
    [
      'a row without an id',
      {rows: [{kind: 'song', id: '', title: ''}]},
      'rows.0.id',
    ],
    [
      'a tile color outside the palette',
      {tiles: {a: [{label: null, labelColor: 'red', lines: []}]}},
      'tiles.a.0.labelColor',
    ],
    ['tiles that are an array', {tiles: []}, 'tiles'],
    ['a negative revision', {revision: -1}, 'revision'],
    ['a read-only flag that is text', {readOnly: 'yes'}, 'readOnly'],
  ])('checks %s', (_name, change, field) => {
    const result = parseShowService({...showService(), ...change});

    expect(result.ok ? null : result.error.field).toBe(field);
  });

  it('rejects values that are not a service', () => {
    for (const value of [undefined, [], 'service', 3]) {
      expect(parseShowService(value).ok).toBe(false);
    }
  });

  it('accepts tile count at limit (10,000) and rejects exceeding it (10,001)', () => {
    const singleTile = {label: null, labelColor: 'none', lines: []};
    const maxTiles = Array.from(
      {length: SHOW_SERVICE_LIMITS.tiles},
      () => singleTile,
    );
    const valid = parseShowService({
      ...showService(),
      tiles: {'item-2': maxTiles},
    });
    expect(valid.ok).toBe(true);

    const overTiles = Array.from(
      {length: SHOW_SERVICE_LIMITS.tiles + 1},
      () => singleTile,
    );
    const invalid = parseShowService({
      ...showService(),
      tiles: {'item-2': overTiles},
    });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.error.field).toBe('tiles.item-2');
    }
  });
});
