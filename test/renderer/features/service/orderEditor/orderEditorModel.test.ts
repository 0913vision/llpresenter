import {describe, expect, it} from 'vitest';
import {createSongGroupId} from '@core/schema/ids';
import {sampleGroupedSong} from '@fixtures/core/songs/blockFixtures';
import {
  groupChoices,
  orderTiles,
} from '@renderer/features/service/orderEditor/orderEditorModel';

const VERSE = createSongGroupId('11111111-1111-4111-a111-111111111111');
const CHORUS = createSongGroupId('22222222-2222-4222-a222-222222222222');
const LABELS = [{name: '후렴', color: '#D68F5F', key: null}] as const;

describe('orderTiles', () => {
  const song = sampleGroupedSong();

  it('numbers the slides of the order and points each at its group place', () => {
    const tiles = orderTiles(song, [CHORUS, VERSE, CHORUS], LABELS);

    expect(tiles.map(tile => [tile.number, tile.chip, tile.text])).toEqual([
      [1, 0, 'third'],
      [2, 1, 'first'],
      [3, 1, 'second'],
      [4, 2, 'third'],
    ]);
    expect(tiles[0]).toMatchObject({label: '후렴', color: '#D68F5F'});
    expect(tiles[1]).toMatchObject({label: '1절', color: 'none'});
  });

  it('points each tile at its slide in the song order', () => {
    expect(
      orderTiles(song, [CHORUS, VERSE], []).map(tile => tile.block),
    ).toEqual([2, 0, 1]);
  });

  it('gives every tile its own key, also for a repeated group', () => {
    const keys = orderTiles(song, [CHORUS, CHORUS], []).map(tile => tile.key);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it('skips a group the song no longer has', () => {
    const gone = createSongGroupId('33333333-3333-4333-a333-333333333333');

    expect(orderTiles(song, [gone, VERSE], []).map(tile => tile.chip)).toEqual([
      1, 1,
    ]);
  });

  it('is empty for an empty order', () => {
    expect(orderTiles(song, [], [])).toEqual([]);
  });
});

describe('groupChoices', () => {
  it('has one chip for each group in file order', () => {
    expect(
      groupChoices(sampleGroupedSong(), LABELS).map(chip => chip.name),
    ).toEqual(['1절', '후렴']);
  });
});
