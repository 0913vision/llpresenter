import {describe, expect, it} from 'vitest';
import {createSongGroupId} from '@core/schema/ids';
import {isItemOfKind, parseService} from '@core/schema/service';
import {withArrangementPick, withOrderEdit} from '@core/songs/itemOrderEdit';
import {sampleGroupedSong} from '@fixtures/core/songs/blockFixtures';
import {expectSuccess} from '@fixtures/core/schema/testHelpers';

const VERSE = createSongGroupId('11111111-1111-4111-a111-111111111111');
const CHORUS = createSongGroupId('22222222-2222-4222-a222-222222222222');

function overlay(from: number, to: number) {
  return {
    id: '50000000-0000-4000-8000-000000000001',
    name: 'clip',
    from,
    to,
    screens: [],
    content: {
      media: '60000000-0000-4000-8000-000000000001',
      loop: true,
      sound: false,
    },
  };
}

function songItem(extra: object) {
  const {order} = expectSuccess(
    parseService(
      JSON.stringify({
        format: 'llservice',
        schemaVersion: 1,
        id: '30000000-0000-4000-8000-000000000001',
        name: '주일 예배',
        date: '2026-11-01T11:00',
        order: [
          {
            id: '40000000-0000-4000-8000-000000000001',
            song: '6f1c2a9e-4b7d-4c1a-9e2f-0123456789ab',
            ...extra,
          },
        ],
      }),
      'memory.llservice',
    ),
  ).data;
  const [item] = order;
  if (!item || !isItemOfKind(item, 'song')) throw new Error('Not a song');
  return item;
}

describe('withOrderEdit', () => {
  const song = sampleGroupedSong();

  it('sets the order and keeps a range on its first and last slide', () => {
    const changed = withOrderEdit(song, [CHORUS, VERSE])(
      songItem({overlays: [overlay(1, 2)]}),
    );
    expect(changed).toMatchObject({
      customOrder: [CHORUS, VERSE],
      overlays: [{from: 2, to: 3}],
    });
  });

  it('keeps an id the song no longer has in the stored order', () => {
    const gone = createSongGroupId('33333333-3333-4333-a333-333333333333');
    const changed = withOrderEdit(song, [CHORUS])(
      songItem({customOrder: [gone, VERSE]}),
    );

    expect(changed).toMatchObject({customOrder: [CHORUS, gone]});
  });

  it('leaves an item without overlays free of an overlays field', () => {
    const changed = withOrderEdit(song, [CHORUS])(songItem({}));
    expect(changed).not.toHaveProperty('overlays');
  });

  it('keeps a range whose slides are all gone', () => {
    const changed = withOrderEdit(
      song,
      [],
    )(songItem({overlays: [overlay(1, 2)]}));
    expect(changed).toMatchObject({overlays: [{from: 1, to: 2}]});
  });
});

describe('withArrangementPick', () => {
  const song = sampleGroupedSong();

  it('drops the custom order and moves the ranges to the 구성', () => {
    const changed = withArrangementPick(
      song,
      '기본순서',
    )(songItem({customOrder: [CHORUS, VERSE], overlays: [overlay(1, 1)]}));
    expect(changed).not.toHaveProperty('customOrder');
    expect(changed).toMatchObject({
      arrangement: '기본순서',
      overlays: [{from: 3, to: 3}],
    });
  });
});
