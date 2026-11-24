import {expect, it} from 'vitest';
import {
  isPowerPointFourThree,
  isPowerPointWidescreen,
} from '@main/import/pptx/powerpointSize';

it.each([
  [1600, 900, true],
  [4, 3, false],
  [16, 10, false],
  [12192000, 6858000, true],
  [1584, 900, true],
  [1583, 900, false],
  [1616, 900, true],
  [1617, 900, false],
])('checks slide ratio %i by %i', (width, height, expected) => {
  expect(isPowerPointWidescreen(width, height)).toBe(expected);
});

it.each([
  [4, 3, true],
  [9144000, 6858000, true],
  [16, 9, false],
  [16, 10, false],
  [1, 1, false],
])(
  'identifies 4:3 independently of size %i by %i',
  (width, height, expected) => {
    expect(isPowerPointFourThree(width, height)).toBe(expected);
  },
);
