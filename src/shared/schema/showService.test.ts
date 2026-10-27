import {describe, expect, it} from 'vitest';
import {parseShowService, SHOW_SERVICE_LIMITS} from './showService';

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

  it('accepts a service and no service', () => {
    expect(parseShowService(showService())).toEqual({
      ok: true,
      value: showService(),
    });
    expect(parseShowService(null)).toEqual({ok: true, value: null});
  });

  it('keeps the kind a 빈 자리 accepts, only on slot rows', () => {
    const slot = {kind: 'slot', id: 'slot', title: '찬양', accepts: 'song'};
    const bible = {kind: 'bible', id: 'bible', title: 'Passage'};
    const bare = {kind: 'slot', id: 'bare', title: '빈 자리'};
    expect(
      parseShowService({
        ...showService(),
        rows: [slot, bare, {...bible, accepts: 'song'}],
      }),
    ).toMatchObject({ok: true, value: {rows: [slot, bare, bible]}});
  });

  it('rejects a 빈 자리 that accepts an unknown kind', () => {
    for (const accepts of ['media', '', 3, null]) {
      expect(
        parseShowService({
          ...showService(),
          rows: [{kind: 'slot', id: 'slot', title: '찬양', accepts}],
        }).ok,
      ).toBe(false);
    }
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
