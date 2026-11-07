import {expect, it} from 'vitest';
import {sampleSong} from '@fixtures/core/songs/blockFixtures';
import {
  blockSnapshot,
  linearSlidesOf,
  slideCountOf,
} from '@core/songs/blockModel';

it('shows every slide label, including adjacent identical names', () => {
  const song = sampleSong();
  expect(slideCountOf(song)).toBe(3);
  expect(linearSlidesOf(song)).toBe(song.slides);
  expect(linearSlidesOf(song).map(slide => slide.label)).toEqual([
    '1절',
    '1절',
    '후렴',
  ]);
});
it('clamps selections to slide text and handles an empty item deck', () => {
  const song = sampleSong();
  expect(
    blockSnapshot(song, {block: 10, start: 50, end: 100}).selection,
  ).toEqual({block: 2, start: 5, end: 5});
  expect(blockSnapshot({...song, slides: []}).selection).toEqual({
    block: 0,
    start: 0,
    end: 0,
  });
});
