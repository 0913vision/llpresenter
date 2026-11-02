import {describe, expect, it} from 'vitest';
import {
  clipSegments,
  nearestSlide,
  newOverlaySpan,
  overlayAt,
  overlayRangesOverlap,
  remapOverlayRanges,
  resizedSpan,
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

describe('overlay span rules', () => {
  const rows = [
    {id: 'a', from: 3, to: 4},
    {id: 'b', from: 8, to: 9},
  ];

  it('finds the overlay that holds a slide', () => {
    expect(overlayAt(rows, 4)?.id).toBe('a');
    expect(overlayAt(rows, 5)).toBeUndefined();
  });

  it('runs a new range to the song end or to the slide before the next overlay', () => {
    expect(newOverlaySpan(rows, 5, 12)).toEqual({from: 5, to: 7});
    expect(newOverlaySpan(rows, 10, 12)).toEqual({from: 10, to: 12});
    expect(newOverlaySpan(rows, 1, 12)).toEqual({from: 1, to: 2});
    expect(newOverlaySpan([], 3, 5)).toEqual({from: 3, to: 5});
  });

  it('starts no range on a slide that has one or outside the slides', () => {
    expect(newOverlaySpan(rows, 3, 12)).toBeUndefined();
    expect(newOverlaySpan(rows, 0, 12)).toBeUndefined();
    expect(newOverlaySpan(rows, 13, 12)).toBeUndefined();
  });

  it('keeps a dragged end on a slide, off the other end, and clear of neighbours', () => {
    expect(
      resizedSpan({
        overlays: rows,
        id: 'a',
        edge: 'to',
        position: 7,
        total: 12,
      }),
    ).toEqual({from: 3, to: 7});
    expect(
      resizedSpan({
        overlays: rows,
        id: 'a',
        edge: 'to',
        position: 11,
        total: 12,
      }),
    ).toEqual({from: 3, to: 7});
    expect(
      resizedSpan({
        overlays: rows,
        id: 'a',
        edge: 'to',
        position: 1,
        total: 12,
      }),
    ).toEqual({from: 3, to: 3});
    expect(
      resizedSpan({
        overlays: rows,
        id: 'b',
        edge: 'from',
        position: 4,
        total: 12,
      }),
    ).toEqual({from: 5, to: 9});
    expect(
      resizedSpan({
        overlays: rows,
        id: 'b',
        edge: 'from',
        position: 11,
        total: 12,
      }),
    ).toEqual({from: 9, to: 9});
    expect(
      resizedSpan({
        overlays: rows,
        id: 'a',
        edge: 'from',
        position: -4,
        total: 12,
      }),
    ).toEqual({from: 1, to: 4});
    expect(
      resizedSpan({
        overlays: rows,
        id: 'x',
        edge: 'to',
        position: 5,
        total: 12,
      }),
    ).toBeUndefined();
  });

  it('picks the slide whose centre is nearest an x', () => {
    expect(nearestSlide(130, [50, 150, 250])).toBe(2);
    expect(nearestSlide(-10, [50, 150])).toBe(1);
    expect(nearestSlide(10, [])).toBeUndefined();
  });

  it('draws a range per row with › where it runs on', () => {
    expect(clipSegments({from: 3, to: 8}, 5)).toEqual([
      {
        row: 0,
        firstColumn: 2,
        lastColumn: 4,
        continuesBefore: false,
        continuesAfter: true,
      },
      {
        row: 1,
        firstColumn: 0,
        lastColumn: 2,
        continuesBefore: true,
        continuesAfter: false,
      },
    ]);
    expect(clipSegments({from: 2, to: 3}, 5)).toHaveLength(1);
    expect(clipSegments({from: 1, to: 11}, 5).map(s => s.row)).toEqual([
      0, 1, 2,
    ]);
    expect(clipSegments({from: 1, to: 2}, 0)).toEqual([]);
  });
});
