import {describe, expect, it} from 'vitest';
import {
  editedOrder,
  editedOrderWithLimit,
  newArrangement,
} from '@core/songs/songArrangements';
import {sampleGroupedSong, song} from '@fixtures/core/songs/blockFixtures';

const GROUP = '11111111-1111-4111-a111-111111111111';

describe('song arrangements', () => {
  it('chooses the first unused name and retains an intentionally empty order', () => {
    const value = {
      ...song(),
      arrangements: [
        {name: '구성 1', slides: [2]},
        {name: '구성 3', slides: []},
      ],
    };

    expect(newArrangement(value, '구성 3')).toEqual({
      name: '구성 2',
      slides: [],
    });
    expect(editedOrder(value, undefined)).toEqual([1, 2, 3]);
  });

  it('refuses a valid billion-slide arrangement and expands the master order without one', () => {
    const large = sampleGroupedSong(
      [
        {
          id: GROUP,
          name: '1절',
          slides: Array.from({length: 10_000}, () => ({lines: ['Invented']})),
        },
      ],
      [{name: 'Large', groups: Array.from({length: 100_000}, () => GROUP)}],
    );

    expect(editedOrderWithLimit(large, 'Large')).toMatchObject({
      slides: [],
      capped: true,
    });
    expect(editedOrderWithLimit(large, undefined).slides).toHaveLength(10_000);
  });
});
