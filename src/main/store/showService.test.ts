import {describe, expect, it} from 'vitest';
import type {Result} from '@core/common/result';
import type {MediaChoice} from '@core/live/state';
import type {FileError, LoadedFile} from '@core/schema/fileFormat';
import type {Label} from '@core/schema/labels';
import {parseService, type Service} from '@core/schema/service';
import {parseSong, type Song} from '@core/schema/song';
import {DEFAULT_LABELS} from './defaults';
import {
  buildShowService,
  projectSongTiles,
  SHOW_SERVICE_LIMITS,
  songTiles,
} from './showService';
import {HYMN_ONE_ID, hymnOne, itemId, service, SUNDAY_ID} from './testFiles';
import {createSongGroupId, createSongId} from '@core/schema/ids';
import type {GroupedSong} from '@core/schema/groupedSong';
import {resolveServicePassages} from '../bible/servicePassages';
import {resolvePassage} from '@core/bible/reference';
import {passageSource} from '@core/bible/testing/testFiles';

const MISSING_SONG_ID = '0f0f0f0f-0f0f-4f0f-8f0f-0f0f0f0f0f0f';
const MEDIA_ID = '3b9d0c52-7e1f-4a2b-8c3d-4e5f60718293';
const NOTICE_ID = '5c2e9a10-1b2c-4d3e-9f40-5a6b7c8d9e0f';

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
  it.each([true, false])(
    'projects normalized saved Bible identity and numbering %s with its tiles',
    async verseNumbers => {
      const document = loadedService(
        ['John 3 : 16 - 18', '시편 1:1'].map((ref, index) => ({
          id: itemId(index + 1),
          bible: {
            translation: 'sample',
            ref,
            split: 'verse',
            reference: 'every',
            verseNumbers,
            translationName: false,
          },
        })),
      );
      const passages = await resolveServicePassages(
        document.data.order,
        {
          lookup: async request => ({
            ...request,
            suggestions: [],
            result: await resolvePassage(passageSource(), request.input),
          }),
        },
        {
          reportError: error => {
            throw error;
          },
        },
      );
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
        bible: {ref: '요한복음 3:16-18', translation: 'sample', verseNumbers},
      });
      expect(show.tiles[itemId(1)]).toHaveLength(3);
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
          {id: itemId(1), song: HYMN_ONE_ID},
          {id: itemId(2), song: HYMN_ONE_ID, background: override.mediaId},
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
      {background: override},
    ]);
    backgrounds.delete(override.mediaId);
    const missing = project().rows[1];
    expect(missing).toMatchObject({problem: 'missing-background'});
    expect(missing).not.toHaveProperty('background');
  });

  it('marks an unavailable default without removing the lyrics', () => {
    const show = buildShowService({
      service: loadedService([{id: itemId(1), song: HYMN_ONE_ID}]),
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

  it('omits the background and warning when neither item nor song has one', () => {
    expect(build([{id: itemId(1), song: HYMN_ONE_ID}]).rows[0]).toEqual({
      kind: 'song',
      id: itemId(1),
      title: '만복의 근원 하나님',
    });
  });

  it('makes a row for each item with the item id', () => {
    const show = build([
      {id: itemId(1), header: '찬양'},
      {id: itemId(2), song: HYMN_ONE_ID},
      {id: itemId(3), slot: 'song', title: '찬양'},
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
      {id: itemId(6), notice: NOTICE_ID},
      {id: itemId(7), scripture: {page: 3}},
      {id: itemId(8), song: MISSING_SONG_ID},
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
      {kind: 'notice', id: itemId(6), title: ''},
      {kind: 'unknown', id: itemId(7), title: '', problem: 'unknown-kind'},
      {kind: 'song', id: itemId(8), title: '', problem: 'missing-song'},
    ]);
    expect(Object.keys(show.tiles)).toEqual([itemId(2)]);
  });

  it('shows files from a newer app version as read-only', () => {
    const show = buildShowService({
      service: loadedService([{id: itemId(1), song: HYMN_ONE_ID}], 99),
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
    const show = build([{id: itemId(1), song: HYMN_ONE_ID}]);

    expect(show.tiles[itemId(1)]).toEqual([
      {
        label: '1절',
        labelColor: 'teal',
        lines: ['만복의 근원 하나님', '온 백성 찬송 드리고'],
      },
      {
        label: '후렴',
        labelColor: 'yellow',
        lines: ['저 천사여 찬송하세', '찬송 성부 성자 성령'],
      },
      {label: null, labelColor: 'none', lines: ['아멘']},
    ]);
  });

  it('follows the chosen 구성, with a tile each time a 장 repeats', () => {
    const show = build([
      {id: itemId(1), song: HYMN_ONE_ID, arrangement: '주일용'},
    ]);

    expect(show.tiles[itemId(1)]?.map(({label}) => label)).toEqual([
      '1절',
      '후렴',
      '1절',
      '후렴',
      null,
    ]);
  });

  it.each([
    ['an empty 구성', '비어 있음'],
    ['a 구성 the song does not have', '없는 구성'],
  ])('uses the default order for %s', (_name, arrangement) => {
    const show = build([{id: itemId(1), song: HYMN_ONE_ID, arrangement}]);

    expect(show.tiles[itemId(1)]).toHaveLength(3);
  });

  it('gives a 이름표 that is not in the list no color', () => {
    const show = build(
      [{id: itemId(1), song: HYMN_ONE_ID}],
      [{name: '1절', color: 'rose', key: null}],
    );

    expect(show.tiles[itemId(1)]?.map(({labelColor}) => labelColor)).toEqual([
      'rose',
      'none',
      'none',
    ]);
  });

  it('maps each jump key to its 이름표, and the first wins a shared key', () => {
    const show = build(
      [],
      [
        {name: '1절', color: 'teal', key: 'Digit1'},
        {name: '후렴', color: 'yellow', key: 'KeyC'},
        {name: '브리지', color: 'violet', key: 'KeyC'},
        {name: '간주', color: 'gray', key: null},
      ],
    );

    expect(show.jumpKeys).toEqual({Digit1: '1절', KeyC: '후렴'});
  });

  it('projects grouped song slides with sourceSlide, label, and hotKey', () => {
    const gSongId = createSongId('20000000-0000-4000-8000-000000000001');
    const g1Id = createSongGroupId('a0000000-0000-4000-8000-000000000001');
    const g2Id = createSongGroupId('a0000000-0000-4000-8000-000000000002');
    const groupedSong: GroupedSong = {
      format: 'llsong',
      schemaVersion: 2,
      id: gSongId,
      title: 'Grouped Song 1',
      groups: [
        {
          id: g1Id,
          name: '1절',
          slides: [
            {lines: ['1절 첫 줄'], hotKey: 'KeyA'},
            {lines: ['1절 둘째 줄']},
          ],
        },
        {
          id: g2Id,
          name: '후렴',
          slides: [{lines: ['후렴 줄'], hotKey: 'KeyC'}],
        },
      ],
    };

    const show = buildShowService({
      service: loadedService([{id: itemId(1), song: gSongId}]),
      songs: new Map([
        [
          gSongId,
          {
            format: 'llsong',
            schemaVersion: 2,
            access: 'editable',
            data: groupedSong,
          },
        ],
      ]),
      labels: [
        {name: '1절', color: 'teal', key: null},
        {name: '후렴', color: 'yellow', key: null},
      ],
      revision: 1,
    });

    expect(show.tiles[itemId(1)]).toEqual([
      {
        label: '1절',
        labelColor: 'teal',
        lines: ['1절 첫 줄'],
        sourceSlide: {
          songId: gSongId,
          groupId: g1Id,
          slideIndex: 0,
        },
        hotKey: 'KeyA',
      },
      {
        label: '1절',
        labelColor: 'teal',
        lines: ['1절 둘째 줄'],
        sourceSlide: {
          songId: gSongId,
          groupId: g1Id,
          slideIndex: 1,
        },
      },
      {
        label: '후렴',
        labelColor: 'yellow',
        lines: ['후렴 줄'],
        sourceSlide: {
          songId: gSongId,
          groupId: g2Id,
          slideIndex: 0,
        },
        hotKey: 'KeyC',
      },
    ]);
  });

  it('projects grouped song with named arrangement and repeated groups', () => {
    const gSongId = createSongId('20000000-0000-4000-8000-000000000002');
    const g1Id = createSongGroupId('b0000000-0000-4000-8000-000000000001');
    const g2Id = createSongGroupId('b0000000-0000-4000-8000-000000000002');
    const groupedSong: GroupedSong = {
      format: 'llsong',
      schemaVersion: 2,
      id: gSongId,
      title: 'Repeated Groups',
      groups: [
        {id: g1Id, name: '1절', slides: [{lines: ['1절']}]},
        {id: g2Id, name: '후렴', slides: [{lines: ['후렴']}]},
      ],
      arrangements: [{name: '반복구성', groups: [g1Id, g2Id, g1Id]}],
    };

    const show = buildShowService({
      service: loadedService([
        {id: itemId(1), song: gSongId, arrangement: '반복구성'},
      ]),
      songs: new Map([
        [
          gSongId,
          {
            format: 'llsong',
            schemaVersion: 2,
            access: 'editable',
            data: groupedSong,
          },
        ],
      ]),
      labels: [{name: '1절', color: 'teal', key: null}],
      revision: 1,
    });

    const tiles = show.tiles[itemId(1)] ?? [];
    expect(tiles).toHaveLength(3);
    expect(tiles.map(t => t.label)).toEqual(['1절', '후렴', '1절']);
    expect(tiles[0]?.sourceSlide).toEqual({
      songId: gSongId,
      groupId: g1Id,
      slideIndex: 0,
    });
    expect(tiles[2]?.sourceSlide).toEqual({
      songId: gSongId,
      groupId: g1Id,
      slideIndex: 0,
    });
  });

  it('falls back to default group order for an empty named arrangement on grouped songs', () => {
    const g1Id = createSongGroupId('11111111-1111-4111-a111-111111111111');
    const gSongId = createSongId('6f1c2a9e-4b7d-4c1a-9e2f-0123456789a2');
    const groupedSong: GroupedSong = {
      format: 'llsong',
      schemaVersion: 2,
      id: gSongId,
      title: '빈 구성 곡',
      groups: [{id: g1Id, name: '1절', slides: [{lines: ['가사']}]}],
      arrangements: [{name: '빈구성', groups: []}],
    };

    const show = buildShowService({
      service: loadedService([
        {id: itemId(1), song: gSongId, arrangement: '빈구성'},
      ]),
      songs: new Map([
        [
          gSongId,
          {
            format: 'llsong',
            schemaVersion: 2,
            access: 'editable',
            data: groupedSong,
          },
        ],
      ]),
      labels: [],
      revision: 1,
    });

    expect(show.tiles[itemId(1)]).toHaveLength(1);
  });

  it('gives unnamed group label: null and labelColor: none', () => {
    const gSongId = createSongId('20000000-0000-4000-8000-000000000003');
    const g1Id = createSongGroupId('c0000000-0000-4000-8000-000000000001');
    const groupedSong: GroupedSong = {
      format: 'llsong',
      schemaVersion: 2,
      id: gSongId,
      title: 'Unnamed Group',
      groups: [{id: g1Id, name: '', slides: [{lines: ['가사']}]}],
    };

    const show = buildShowService({
      service: loadedService([{id: itemId(1), song: gSongId}]),
      songs: new Map([
        [
          gSongId,
          {
            format: 'llsong',
            schemaVersion: 2,
            access: 'editable',
            data: groupedSong,
          },
        ],
      ]),
      labels: [],
      revision: 1,
    });

    expect(show.tiles[itemId(1)]).toEqual([
      {
        label: null,
        labelColor: 'none',
        lines: ['가사'],
        sourceSlide: {
          songId: gSongId,
          groupId: g1Id,
          slideIndex: 0,
        },
      },
    ]);
  });

  it('accepts exactly 10,000 tiles for grouped songs without flagging capped', () => {
    const gSongId = createSongId('20000000-0000-4000-8000-000000000004');
    const g1Id = createSongGroupId('d0000000-0000-4000-8000-000000000001');
    const slides = Array.from({length: 100}, (_, index) => ({
      lines: [`Slide ${index + 1}`],
    }));
    const repeatedGroups = Array.from({length: 100}, () => g1Id);
    const maxSong: GroupedSong = {
      format: 'llsong',
      schemaVersion: 2,
      id: gSongId,
      title: 'Max Grouped Song',
      groups: [{id: g1Id, name: '반복절', slides}],
      arrangements: [{name: '한계구성', groups: repeatedGroups}],
    };

    const projected = projectSongTiles(maxSong, new Map(), '한계구성');
    expect(projected.capped).toBe(false);
    expect(projected.tiles).toHaveLength(10_000);

    const show = buildShowService({
      service: loadedService([
        {id: itemId(1), song: gSongId, arrangement: '한계구성'},
      ]),
      songs: new Map([
        [
          gSongId,
          {
            format: 'llsong',
            schemaVersion: 2,
            access: 'editable',
            data: maxSong,
          },
        ],
      ]),
      labels: [],
      revision: 1,
    });

    expect(show.rows[0]).not.toHaveProperty('problem');
    expect(show.tiles[itemId(1)]).toHaveLength(10_000);
  });

  it('stops iteration and marks row tile-limit when tile expansion exceeds limit (10,001 tiles)', () => {
    const gSongId = createSongId('20000000-0000-4000-8000-000000000005');
    const g1Id = createSongGroupId('d0000000-0000-4000-8000-000000000002');
    const slides = Array.from({length: 100}, (_, index) => ({
      lines: [`Slide ${index + 1}`],
    }));
    const repeatedGroups = Array.from({length: 101}, () => g1Id);
    const hugeSong: GroupedSong = {
      format: 'llsong',
      schemaVersion: 2,
      id: gSongId,
      title: 'Huge Grouped Song',
      groups: [{id: g1Id, name: '반복절', slides}],
      arrangements: [{name: '초과구성', groups: repeatedGroups}],
    };

    const projected = projectSongTiles(hugeSong, new Map(), '초과구성');
    expect(projected.capped).toBe(true);
    expect(projected.tiles).toEqual([]);

    const show = buildShowService({
      service: loadedService([
        {id: itemId(1), song: gSongId, arrangement: '초과구성'},
      ]),
      songs: new Map([
        [
          gSongId,
          {
            format: 'llsong',
            schemaVersion: 2,
            access: 'editable',
            data: hugeSong,
          },
        ],
      ]),
      labels: [],
      revision: 1,
    });

    expect(show.rows[0]).toMatchObject({
      kind: 'song',
      id: itemId(1),
      problem: 'tile-limit',
    });
    expect(show.tiles[itemId(1)]).toEqual([]);

    expect(songTiles(hugeSong, new Map(), '초과구성')).toEqual([]);
    expect(SHOW_SERVICE_LIMITS.tiles).toBe(10_000);
  });

  it('accepts exactly 10,000 tiles and flags capped at 10,001 tiles for v1 songs', () => {
    const maxV1Song: Song = {
      ...loadedSong(hymnOne()).data,
      arrangements: [
        {
          name: '한계구성',
          slides: Array.from({length: 10_000}, () => 1),
        },
      ],
    };
    const maxProjected = projectSongTiles(maxV1Song, new Map(), '한계구성');
    expect(maxProjected.capped).toBe(false);
    expect(maxProjected.tiles).toHaveLength(10_000);

    const overV1Song: Song = {
      ...loadedSong(hymnOne()).data,
      arrangements: [
        {
          name: '초과구성',
          slides: Array.from({length: 10_001}, () => 1),
        },
      ],
    };
    const overProjected = projectSongTiles(overV1Song, new Map(), '초과구성');
    expect(overProjected.capped).toBe(true);
    expect(overProjected.tiles).toEqual([]);
  });
});
