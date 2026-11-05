import {expect, it} from 'vitest';
import {parseSlidesProjection} from '@core/schema/slidesProjection';
import {projectSlides} from '@core/presentation/slides';
import {slidesItem, SLIDES_ITEM} from '@fixtures/core/slides';
const SUNDAY_ID = '00000000-0000-4000-8000-000000000001';

const value = () => ({
  serviceId: SUNDAY_ID,
  itemId: SLIDES_ITEM,
  revision: 1,
  measurement: {themes: 1, screens: 1, bibleCuts: 1},
  tiles: projectSlides(slidesItem('blank')),
});

it('accepts bounded output-ready slide sequences and rejects raw or malformed payloads', () => {
  const valid = value();
  expect(parseSlidesProjection(valid)).toMatchObject({ok: true, value: valid});
  for (const patch of [
    {serviceId: 'bad-id'},
    {itemId: 'bad-id'},
    {revision: 0},
    {measurement: undefined},
    {measurement: {themes: 0, screens: 1, bibleCuts: 1}},
    {measurement: {themes: 1, screens: -1, bibleCuts: 1}},
    {measurement: {themes: 1, screens: 1, bibleCuts: 1.5}},
    {tiles: []},
    {tiles: Array.from({length: 10_001}, () => valid.tiles[0])},
  ]) {
    expect(parseSlidesProjection({...valid, ...patch}).ok).toBe(false);
  }
  for (const patch of [
    {sourceSlideId: 'bad-id'},
    {sourceSlideId: undefined},
    {kind: undefined},
    {label: 'x'.repeat(4001)},
    {lines: ['x'.repeat(4001)]},
    {lines: Array.from({length: 1001}, () => '')},
    {biblePart: 0},
    {biblePart: 10_001},
    {biblePart: 1.5},
    {media: {mediaId: 'media', loop: false}},
  ]) {
    expect(
      parseSlidesProjection({...valid, tiles: [{...valid.tiles[0], ...patch}]})
        .ok,
    ).toBe(false);
  }
});

it('caps the total text across otherwise valid individual parts', () => {
  const valid = value();
  const tile = {...valid.tiles[0], lines: ['x'.repeat(4000)]};
  expect(
    parseSlidesProjection({
      ...valid,
      tiles: Array.from({length: 2000}, () => tile),
    }).ok,
  ).toBe(false);
});
