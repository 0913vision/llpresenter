import {expect, it} from 'vitest';
import {itemMedia, fixtureMedia} from '../testing/mediaList';
import {
  backgroundElapsedSeconds,
  backgroundProgress,
} from './backgroundPosition';

const items = itemMedia().value.items.map(item => ({...item, duration: 54}));
const media = {mediaId: fixtureMedia.dawn, startedAt: 1000, loop: true};

it('uses the main timeline, wraps loops and holds a nonlooping video at its end', () => {
  expect(backgroundProgress(media, items, 13_000)).toMatchObject({
    positionSeconds: 12,
    durationSeconds: 54,
  });
  expect(backgroundProgress(media, items, 67_000)?.positionSeconds).toBe(12);
  expect(
    backgroundProgress({...media, loop: false}, items, 67_000)?.positionSeconds,
  ).toBe(54);
  expect(backgroundProgress(media, items, 0)?.positionSeconds).toBe(0);
});

it('includes the base position and speed without inventing a duration', () => {
  const sped = {
    ...media,
    positionSeconds: 8,
    properties: {speed: 2, fit: 'fit' as const, volume: 100, audio: false},
  };
  expect(backgroundElapsedSeconds(sped, 3000)).toBe(12);
  expect(backgroundProgress(sped, itemMedia().value.items, 3000)).toMatchObject(
    {positionSeconds: 12, durationSeconds: null},
  );
});

it('has no reading for images, audio, missing metadata or a cleared layer', () => {
  expect(backgroundProgress(null, items, 2000)).toBeNull();
  expect(
    backgroundProgress({...media, mediaId: fixtureMedia.warm}, items, 2000),
  ).toBeNull();
  expect(
    backgroundProgress({...media, mediaId: fixtureMedia.hymn}, items, 2000),
  ).toBeNull();
  expect(backgroundProgress(media, [], 2000)).toBeNull();
});
