import {describe, expect, it} from 'vitest';
import {
  overlayRangesOverlap,
  remapOverlayRanges,
} from '@core/themes/overlayRanges';

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

describe('remapOverlayRanges', () => {
  const span = (from: number, to: number) => ({id: `${from}-${to}`, from, to});

  it('returns the same overlays when the order does not change', () => {
    const overlays = [span(2, 3)];
    expect(remapOverlayRanges(overlays, [1, 2, 3, 4], [1, 2, 3, 4])).toEqual(
      overlays,
    );
  });

  it('keeps a range on its start and end slides when slides move', () => {
    const result = remapOverlayRanges([span(2, 3)], [1, 2, 3, 4], [4, 1, 2, 3]);
    expect(result).toEqual([{id: '2-3', from: 3, to: 4}]);
  });

  it('shifts a range when a slide is added before it', () => {
    const result = remapOverlayRanges([span(2, 3)], [1, 2, 3], [1, 1, 2, 3]);
    expect(result.map(({from, to}) => [from, to])).toEqual([[3, 4]]);
  });

  it('hands the end to the slide before it when the end slide is removed', () => {
    const result = remapOverlayRanges([span(2, 4)], [1, 2, 3, 4], [1, 2, 3]);
    expect(result.map(({from, to}) => [from, to])).toEqual([[2, 3]]);
  });

  it('starts at the next slide when the start slide is removed', () => {
    const result = remapOverlayRanges([span(2, 4)], [1, 2, 3, 4], [1, 3, 4]);
    expect(result.map(({from, to}) => [from, to])).toEqual([[2, 3]]);
  });

  it('keeps a range whose slides are all removed as it was', () => {
    const result = remapOverlayRanges([span(2, 3)], [1, 2, 3, 4], [1, 4]);
    expect(result.map(({from, to}) => [from, to])).toEqual([[2, 3]]);
  });

  it('keeps from before to when the ends swap places', () => {
    const result = remapOverlayRanges([span(1, 2)], [1, 2], [2, 1]);
    expect(result.map(({from, to}) => [from, to])).toEqual([[1, 2]]);
  });

  it('matches repeated slides by their occurrence', () => {
    const result = remapOverlayRanges(
      [span(3, 4)],
      [1, 2, 1, 2],
      [1, 2, 1, 2, 1],
    );
    expect(result.map(({from, to}) => [from, to])).toEqual([[3, 4]]);
  });

  it('drops a range that would fall inside the one before it', () => {
    const result = remapOverlayRanges(
      [span(1, 2), span(3, 3)],
      [1, 2, 3],
      [1, 3, 2],
    );
    expect(result.map(({from, to}) => [from, to])).toEqual([[1, 3]]);
  });

  it('starts a range after the one before it when they would overlap', () => {
    const result = remapOverlayRanges(
      [span(1, 2), span(3, 4)],
      [1, 2, 3, 4],
      [1, 3, 2, 4],
    );
    expect(result.map(({from, to}) => [from, to])).toEqual([
      [1, 3],
      [4, 4],
    ]);
  });
});
