import {expect, it} from 'vitest';
import {overlayRangesOverlap} from './overlayRanges';

it.each([
  {ranges: [], overlap: false},
  {ranges: [{from: 1, to: 1}], overlap: false},
  {
    ranges: [
      {from: 3, to: 5},
      {from: 1, to: 2},
    ],
    overlap: false,
  },
  {
    ranges: [
      {from: 3, to: 5},
      {from: 1, to: 3},
    ],
    overlap: true,
  },
  {
    ranges: [
      {from: 1, to: 10},
      {from: 3, to: 4},
    ],
    overlap: true,
  },
  {
    ranges: [
      {from: 2, to: 2},
      {from: 2, to: 2},
    ],
    overlap: true,
  },
])(
  'detects inclusive intersections without mutation: %j',
  ({ranges, overlap}) => {
    const original = structuredClone(ranges);
    expect(overlayRangesOverlap(ranges)).toBe(overlap);
    expect(ranges).toEqual(original);
  },
);
