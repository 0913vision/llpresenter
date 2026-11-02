import {describe, expect, it} from 'vitest';
import {editedOrderWithLimit} from '@core/songs/songArrangements';
import {sampleGroupedSong} from '@fixtures/core/songs/blockFixtures';

const GROUP = '11111111-1111-4111-a111-111111111111';

describe('song arrangements', () => {
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
