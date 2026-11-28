import {expect, it} from 'vitest';
import {pointedItem} from '@renderer/features/service/order/rows/pointedItem';

const live = 'song-river';

it('marks the live item while its slide is in sight, even with another item at the top', () => {
  expect(
    pointedItem({
      picked: null,
      liveItemId: live,
      liveInSight: true,
      topItemId: 'song-morning',
    }),
  ).toBe(live);
});

it('marks the item at the top once the live slide is scrolled out of sight', () => {
  expect(
    pointedItem({
      picked: null,
      liveItemId: live,
      liveInSight: false,
      topItemId: 'psalm-23',
    }),
  ).toBe('psalm-23');
});

it('keeps a picked row while the item live at the pick stays live, and drops it after', () => {
  const picked = {id: 'psalm-23', liveItemId: live};
  expect(
    pointedItem({picked, liveItemId: live, liveInSight: true, topItemId: null}),
  ).toBe('psalm-23');
  expect(
    pointedItem({
      picked,
      liveItemId: 'psalm-23',
      liveInSight: true,
      topItemId: null,
    }),
  ).toBe('psalm-23');
  expect(
    pointedItem({
      picked,
      liveItemId: 'song-morning',
      liveInSight: true,
      topItemId: 'psalm-23',
    }),
  ).toBe('song-morning');
});

it('marks the item at the top with nothing live', () => {
  expect(
    pointedItem({
      picked: null,
      liveItemId: null,
      liveInSight: false,
      topItemId: 'song-morning',
    }),
  ).toBe('song-morning');
});
