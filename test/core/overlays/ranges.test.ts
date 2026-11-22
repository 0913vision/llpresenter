import {describe, expect, it} from 'vitest';
import {
  newOverlaySpan,
  normalizeOverlayRanges,
  overlayAt,
  overlayRangesOverlap,
  resizedSpan,
} from '@core/overlays/ranges';

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

it('keeps earlier ranges and cuts later ones short, in the given order', () => {
  const ranges = [
    {id: 'late', from: 3, to: 6},
    {id: 'early', from: 1, to: 4},
    {id: 'inside', from: 2, to: 3},
  ];
  expect(normalizeOverlayRanges(ranges)).toEqual([
    {id: 'late', from: 5, to: 6},
    {id: 'early', from: 1, to: 4},
  ]);
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
});
