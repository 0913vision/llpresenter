import {describe, expect, it} from 'vitest';
import {
  createServiceItemId,
  createSongGroupId,
  createSongId,
  type SongGroupId,
} from '@core/schema/ids';
import {isItemOfKind, type ServiceItem} from '@core/schema/service';
import {
  arrangementFromOrder,
  playedGroupIds,
  playedOrderWithLimit,
  withArrangementChoice,
  withCustomOrder,
  withServiceItemSong,
  withSong,
} from '@core/songs/itemOrder';
import {sampleGroupedSong} from '@fixtures/core/songs/blockFixtures';
import {expectSuccess} from '@fixtures/core/schema/testHelpers';
import {parseService} from '@core/schema/service';

const VERSE = createSongGroupId('11111111-1111-4111-a111-111111111111');
const CHORUS = createSongGroupId('22222222-2222-4222-a222-222222222222');
const OTHER_SONG = createSongId('7a1c2a9e-4b7d-4c1a-9e2f-0123456789ab');

function items(entries: readonly object[]): readonly ServiceItem[] {
  return expectSuccess(
    parseService(
      JSON.stringify({
        format: 'llservice',
        schemaVersion: 1,
        id: '30000000-0000-4000-8000-000000000001',
        name: '주일 예배',
        date: '2026-11-01T11:00',
        order: entries,
      }),
      'memory.llservice',
    ),
  ).data.order;
}

function songItem(extra: object = {}) {
  const [item] = items([
    {
      id: '40000000-0000-4000-8000-000000000001',
      song: '6f1c2a9e-4b7d-4c1a-9e2f-0123456789ab',
      ...extra,
    },
  ]);
  if (!item || !isItemOfKind(item, 'song')) throw new Error('Not a song');
  return item;
}

function header(): ServiceItem {
  const [item] = items([
    {id: '40000000-0000-4000-8000-000000000002', header: '찬양'},
  ]);
  if (!item) throw new Error('Missing item');
  return item;
}

describe('playedGroupIds', () => {
  const song = sampleGroupedSong();

  it('plays all groups, then the 구성, then the custom order', () => {
    expect(playedGroupIds(song, songItem())).toEqual([VERSE, CHORUS]);
    expect(playedGroupIds(song, songItem({arrangement: '기본순서'}))).toEqual([
      VERSE,
      CHORUS,
    ]);
    expect(
      playedGroupIds(
        song,
        songItem({
          arrangement: '기본순서',
          customOrder: [CHORUS, VERSE, CHORUS],
        }),
      ),
    ).toEqual([CHORUS, VERSE, CHORUS]);
  });

  it('skips a group the song no longer has and plays an empty order as empty', () => {
    const gone = '33333333-3333-4333-a333-333333333333';
    expect(
      playedGroupIds(song, songItem({customOrder: [gone, CHORUS]})),
    ).toEqual([CHORUS]);
    expect(playedGroupIds(song, songItem({customOrder: []}))).toEqual([]);
  });
});

describe('playedOrderWithLimit', () => {
  it('expands the custom order into slide numbers', () => {
    const song = sampleGroupedSong();
    const played = playedOrderWithLimit(
      song,
      songItem({customOrder: [CHORUS, VERSE]}),
    );
    expect(played.slides).toEqual([3, 1, 2]);
    expect(played.capped).toBe(false);
  });
});

describe('item changes', () => {
  it('sets and clears the custom order and refuses other kinds', () => {
    const set = withCustomOrder([CHORUS])(songItem({arrangement: '기본순서'}));
    expect(set).toMatchObject({arrangement: '기본순서', customOrder: [CHORUS]});
    const cleared = withCustomOrder(undefined)(set ?? songItem());
    expect(cleared).not.toHaveProperty('customOrder');
    expect(cleared).toHaveProperty('arrangement', '기본순서');
    const plain = songItem();
    expect(withCustomOrder(undefined)(plain)).toBe(plain);
    expect(withCustomOrder([CHORUS])(header())).toBeNull();
  });

  it('picks a 구성 and drops the custom order', () => {
    const picked = withArrangementChoice('짧게')(
      songItem({arrangement: '길게', customOrder: [VERSE]}),
    );
    expect(picked).toHaveProperty('arrangement', '짧게');
    expect(picked).not.toHaveProperty('customOrder');
    const basic = withArrangementChoice(undefined)(
      songItem({arrangement: '길게'}),
    );
    expect(basic).not.toHaveProperty('arrangement');
    expect(withArrangementChoice('짧게')(header())).toBeNull();
  });

  it('switches the song of a song item only', () => {
    const item = songItem({arrangement: '기본순서'});
    expect(withSong(item, OTHER_SONG)).toMatchObject({
      song: OTHER_SONG,
      arrangement: '기본순서',
    });
    expect(withSong(item, item.song)).toBe(item);
    expect(withSong(header(), OTHER_SONG)).toBeNull();
  });
});

describe('withServiceItemSong', () => {
  const service = {
    format: 'llservice',
    schemaVersion: 1,
    id: '30000000-0000-4000-8000-000000000001',
    name: '주일 예배',
    date: '2026-11-01T11:00',
    order: [
      {
        id: '40000000-0000-4000-8000-000000000001',
        song: '6f1c2a9e-4b7d-4c1a-9e2f-0123456789ab',
      },
      {id: '40000000-0000-4000-8000-000000000002', header: '찬양'},
    ],
  };
  const parsed = expectSuccess(
    parseService(JSON.stringify(service), 'memory.llservice'),
  ).data;
  const [, second] = parsed.order;

  it('switches only the named song item', () => {
    const result = withServiceItemSong(
      parsed,
      createServiceItemId('40000000-0000-4000-8000-000000000001'),
      OTHER_SONG,
    );
    expect(result?.order[0]).toMatchObject({song: OTHER_SONG});
    expect(result?.order[1]).toEqual(second);
  });

  it('answers null for a header or a missing item', () => {
    expect(
      withServiceItemSong(
        parsed,
        createServiceItemId('40000000-0000-4000-8000-000000000002'),
        OTHER_SONG,
      ),
    ).toBeNull();
    expect(
      withServiceItemSong(
        parsed,
        createServiceItemId('40000000-0000-4000-8000-000000000009'),
        OTHER_SONG,
      ),
    ).toBeNull();
  });
});

describe('arrangementFromOrder', () => {
  const song = sampleGroupedSong();

  it('adds a 구성 from the ids', () => {
    const result = arrangementFromOrder(song, '짧게', [CHORUS, VERSE]);
    expect(result).toMatchObject({ok: true});
    expect(result.ok && result.value.arrangements?.at(-1)).toEqual({
      name: '짧게',
      groups: [CHORUS, VERSE],
    });
  });

  it('refuses a taken name, a bad name, and an order past the cap', () => {
    expect(arrangementFromOrder(song, '기본순서', [VERSE])).toEqual({
      ok: false,
      error: 'name-taken',
    });
    expect(arrangementFromOrder(song, '  ', [VERSE])).toEqual({
      ok: false,
      error: 'bad-name',
    });
    expect(
      arrangementFromOrder(
        song,
        '길게',
        new Array<SongGroupId>(100_000).fill(VERSE),
      ),
    ).toEqual({ok: false, error: 'too-long'});
  });
});
