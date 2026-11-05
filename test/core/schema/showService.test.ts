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
        {label: '1절', labelColor: 'teal', lines: ['만복의 근원 하나님']},
        {label: null, labelColor: 'none', lines: []},
      ],
    },
    jumpKeys: {KeyC: '후렴'},
  };
}

describe('parseShowService', () => {
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

  it('keeps the media of a media tile and the start of a 공지 tile', () => {
    const tiles = [
      {
        label: null,
        labelColor: 'none',
        lines: ['카운트다운'],
        media: {mediaId: '3b9d0c52-7e1f-4a2b-8c3d-4e5f60718293', loop: true},
      },
      {
        label: null,
        labelColor: 'none',
        lines: ['광고'],
        notice: {noticeId: '5c2e9a10-1b2c-4d3e-9f40-5a6b7c8d9e0f', position: 1},
      },
    ];
    const parsed = parseShowService({
      ...showService(),
      tiles: {'item-2': tiles},
    });
    expect(parsed.ok && parsed.value?.tiles['item-2']).toEqual(tiles);
  });

  it.each([
    {noticeId: 'not-a-uuid', position: 0},
    {noticeId: '5c2e9a10-1b2c-4d3e-9f40-5a6b7c8d9e0f', position: -1},
    {noticeId: '5c2e9a10-1b2c-4d3e-9f40-5a6b7c8d9e0f'},
  ])('rejects the 공지 tile start %j', notice => {
    const tile = {label: null, labelColor: 'none', lines: [], notice};
    expect(
      parseShowService({...showService(), tiles: {'item-2': [tile]}}).ok,
    ).toBe(false);
  });

  it('keeps the source slide and hot key of a tile', () => {
    const sourceSlide = {
      songId: '00000000-0000-4000-8000-000000000001',
      groupId: '00000000-0000-4000-8000-000000000002',
      slideIndex: 1,
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
        groupId: '00000000-0000-4000-8000-000000000002',
        slideIndex: 0,
      },
    },
    {hotKey: null},
    {
      sourceSlide: {
        songId: '00000000-0000-4000-8000-000000000001',
        groupId: '00000000-0000-4000-8000-000000000002',
        slideIndex: -1,
      },
    },
    {
      sourceSlide: {
        songId: '00000000-0000-4000-8000-000000000001',
        groupId: '00000000-0000-4000-8000-000000000002',
        slideIndex: 0.5,
      },
    },
    {
      sourceSlide: {
        songId: 'invalid',
        groupId: '00000000-0000-4000-8000-000000000002',
        slideIndex: 0,
      },
    },
    {
      sourceSlide: {
        songId: '00000000-0000-4000-8000-000000000001',
        groupId: 'invalid',
        slideIndex: 0,
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
