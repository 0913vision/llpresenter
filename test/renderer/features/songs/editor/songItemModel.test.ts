import {expect, it} from 'vitest';
import {sampleSong} from '@fixtures/core/songs/blockFixtures';
import {
  itemPicture,
  shownPosition,
} from '@renderer/features/songs/editor/songItemModel';

it('pictures the selected slide and its next slide in deck order', () => {
  const song = sampleSong();
  expect(itemPicture({song, position: 1, background: 'image'})).toEqual({
    song,
    block: 1,
    nextBlock: 2,
    background: 'image',
    position: 2,
    total: 3,
  });
  expect(itemPicture({song, position: 9, background: undefined})).toEqual({
    song,
    block: 2,
    nextBlock: undefined,
    background: undefined,
    position: 3,
    total: 3,
  });
});
it('shows no picture for an empty deck', () => {
  expect(shownPosition(5, 0)).toBeUndefined();
  expect(
    itemPicture({
      song: {...sampleSong(), slides: []},
      position: 0,
      background: undefined,
    }),
  ).toBeNull();
});
