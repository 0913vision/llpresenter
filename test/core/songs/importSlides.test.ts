import {expect, it} from 'vitest';
import {importSlides} from '@core/songs/importSlides';
import {fixtureSlideId} from '@fixtures/core/songs/slideFixtures';

it('keeps each imported slide independent and copies mapped header names', () => {
  let next = 0;
  const slides = importSlides(
    [
      {label: '1절', lines: ['a'], section: 0},
      {label: '1절', lines: ['b'], section: 0},
      {label: '후렴', lines: ['c'], section: 1},
      {lines: ['d']},
    ],
    () => fixtureSlideId(++next),
  );
  expect(slides).toEqual([
    {id: fixtureSlideId(1), label: '1절', lines: ['a']},
    {id: fixtureSlideId(2), label: '1절', lines: ['b']},
    {id: fixtureSlideId(3), label: '후렴', lines: ['c']},
    {id: fixtureSlideId(4), lines: ['d']},
  ]);
});

it('keeps the main title box line count in the saved slide', () => {
  const slides = importSlides(
    [
      {
        titleSlide: true,
        titleLineCount: 2,
        lines: ['Number', 'Title', 'Subtitle'],
      },
    ],
    () => fixtureSlideId(1),
  );
  expect(slides[0]).toMatchObject({titleSlide: true, titleLineCount: 2});
});
