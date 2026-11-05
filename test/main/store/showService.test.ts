import * as v from 'valibot';
import {describe, expect, it} from 'vitest';
import type {Result} from '@core/common/result';
import type {MediaChoice} from '@core/live/state';
import type {FileError, LoadedFile} from '@core/schema/fileFormat';
import type {Label} from '@core/schema/labels';
import {mediaListSchema} from '@core/schema/mediaList';
import {noticesSchema} from '@core/schema/notices';
import {parseService, type Service} from '@core/schema/service';
import {playedOrderWithLimit} from '@core/songs/itemOrder';
import {DEFAULT_LABELS} from '@main/store/defaults';
import {
  buildShowService,
  projectSongTiles,
  SHOW_SERVICE_LIMITS,
  songTiles,
} from '@main/store/showService';
import {
  HYMN_ONE_GROUPS,
  HYMN_ONE_ID,
  hymnOne,
  itemId,
  service,
  SUNDAY_ID,
} from '@fixtures/main/store/testFiles';
import {createSongGroupId, createSongId} from '@core/schema/ids';
import {parseGroupedSong, type GroupedSong} from '@core/schema/groupedSong';
import type {ServicePassages} from '@main/bible/servicePassages';
import {translationIdSchema} from '@core/schema/ids';
import {slidesItem, SLIDES_ITEM} from '@fixtures/core/slides';

const MISSING_SONG_ID = '0f0f0f0f-0f0f-4f0f-8f0f-0f0f0f0f0f0f';
const MEDIA_ID = '3b9d0c52-7e1f-4a2b-8c3d-4e5f60718293';
const NOTICE_ID = '5c2e9a10-1b2c-4d3e-9f40-5a6b7c8d9e0f';

function loaded<T>(parsed: Result<LoadedFile<T>, FileError>): LoadedFile<T> {
  if (!parsed.ok) {
    throw new Error(parsed.error.message);
  }
  return parsed.value;
}

function loadedSong(json: object): LoadedFile<GroupedSong> {
  return loaded(parseGroupedSong(JSON.stringify(json), 'song.llsong'));
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

  it('makes a row for each item with the item id', () => {
    const show = build([
      {id: itemId(1), header: '찬양'},
      {id: itemId(2), song: HYMN_ONE_ID},
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

    expect(show.tiles[itemId(1)]).toMatchObject([
      {
        label: '1절',
        labelColor: 'teal',
        lines: ['만복의 근원 하나님', '온 백성 찬송 드리고'],
        sourceSlide: {groupId: HYMN_ONE_GROUPS[0], slideIndex: 0},
      },
      {
        label: '후렴',
        labelColor: 'yellow',
        lines: ['저 천사여 찬송하세', '찬송 성부 성자 성령'],
      },
      {label: null, labelColor: 'none', lines: ['아멘']},
    ]);
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
      schemaVersion: 1,
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
            schemaVersion: 1,
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
      schemaVersion: 1,
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
            schemaVersion: 1,
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

  it('gives unnamed group label: null and labelColor: none', () => {
    const gSongId = createSongId('20000000-0000-4000-8000-000000000003');
    const g1Id = createSongGroupId('c0000000-0000-4000-8000-000000000001');
    const groupedSong: GroupedSong = {
      format: 'llsong',
      schemaVersion: 1,
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
            schemaVersion: 1,
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
      schemaVersion: 1,
      id: gSongId,
      title: 'Max Grouped Song',
      groups: [{id: g1Id, name: '반복절', slides}],
      arrangements: [{name: '한계구성', groups: repeatedGroups}],
    };

    const projected = projectSongTiles(maxSong, new Map(), {
      arrangement: '한계구성',
    });
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
            schemaVersion: 1,
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
      schemaVersion: 1,
      id: gSongId,
      title: 'Huge Grouped Song',
      groups: [{id: g1Id, name: '반복절', slides}],
      arrangements: [{name: '초과구성', groups: repeatedGroups}],
    };

    const projected = projectSongTiles(hugeSong, new Map(), {
      arrangement: '초과구성',
    });
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
            schemaVersion: 1,
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

    expect(songTiles(hugeSong, new Map(), {arrangement: '초과구성'})).toEqual(
      [],
    );
    expect(SHOW_SERVICE_LIMITS.tiles).toBe(10_000);
  });
});

describe('projectSongTiles custom order', () => {
  const verse = createSongGroupId('d0000000-0000-4000-8000-0000000000a1');
  const chorus = createSongGroupId('d0000000-0000-4000-8000-0000000000a2');
  const song: GroupedSong = {
    format: 'llsong',
    schemaVersion: 1,
    id: createSongId('20000000-0000-4000-8000-0000000000a1'),
    title: 'Order Song',
    groups: [
      {id: verse, name: '1절', slides: [{lines: ['verse']}]},
      {id: chorus, name: '후렴', slides: [{lines: ['chorus']}]},
    ],
    arrangements: [{name: 'short', groups: [verse]}],
  };
  const linesOf = (play: Parameters<typeof songTiles>[2]): string[] =>
    songTiles(song, new Map(), play).map(tile => tile.lines.join(''));

  it('plays the custom order instead of the named 구성', () => {
    expect(
      linesOf({arrangement: 'short', customOrder: [chorus, verse, chorus]}),
    ).toEqual(['chorus', 'verse', 'chorus']);
  });

  it('skips a group the song no longer has and plays an empty order as empty', () => {
    const gone = createSongGroupId('d0000000-0000-4000-8000-0000000000a9');
    expect(linesOf({customOrder: [gone, verse]})).toEqual(['verse']);
    expect(linesOf({customOrder: []})).toEqual([]);
  });

  it('plays an empty 구성 as all groups, as the 슬라이드 list does', () => {
    const empty: GroupedSong = {
      ...song,
      arrangements: [{name: 'empty', groups: []}],
    };
    const play = {arrangement: 'empty'};

    expect(
      songTiles(empty, new Map(), play).map(tile => tile.lines.join('')),
    ).toEqual(['verse', 'chorus']);
    expect(playedOrderWithLimit(empty, play).slides).toEqual([1, 2]);
  });

  it('keeps playing the named 구성 when there is no custom order', () => {
    expect(linesOf({arrangement: 'short'})).toEqual(['verse']);
  });
});

describe('buildShowService media and 공지 items', () => {
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
  const notices = new Map(
    v
      .parse(noticesSchema, {
        format: 'llsettings.notices',
        schemaVersion: 1,
        sets: [
          {
            id: NOTICE_ID,
            name: '주일 광고',
            media: [IMAGE_ID, MISSING_SONG_ID, OTHER_IMAGE_ID],
            interval: 5,
            loop: true,
            targets: [],
          },
        ],
      })
      .sets.map(set => [set.id, set]),
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
      notices,
    });
  }

  it('names the rows by the media and the 공지 set, as 준비 does', () => {
    const show = buildOthers([
      {id: itemId(1), media: IMAGE_ID},
      {id: itemId(2), media: OTHER_IMAGE_ID},
      {id: itemId(3), notice: NOTICE_ID},
    ]);
    expect(show.rows.map(row => row.title)).toEqual([
      '광고 배경',
      '이름 없는 미디어',
      '주일 광고',
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

  it('gives a 공지 item a tile per image that starts the 공지 from it', () => {
    const show = buildOthers([{id: itemId(1), notice: NOTICE_ID}]);
    expect(
      show.tiles[itemId(1)]?.map(tile => [tile.lines, tile.notice]),
    ).toEqual([
      [['광고 배경'], {noticeId: NOTICE_ID, position: 0, media: IMAGE_ID}],
      [
        ['이름 없는 미디어'],
        {noticeId: NOTICE_ID, position: 2, media: OTHER_IMAGE_ID},
      ],
    ]);
  });

  it('warns about a media file or 공지 set that is gone, without a tile', () => {
    const show = buildOthers(
      [
        {id: itemId(1), media: IMAGE_ID},
        {id: itemId(2), notice: MEDIA_ID},
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
      {kind: 'notice', id: itemId(2), title: '', problem: 'missing-media'},
      {kind: 'media', id: itemId(3), title: '전주'},
    ]);
    expect(show.tiles).toEqual({
      [itemId(1)]: [],
      [itemId(2)]: [],
      [itemId(3)]: [],
    });
  });
});
