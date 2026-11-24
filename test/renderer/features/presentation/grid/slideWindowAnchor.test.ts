import {describe, expect, it} from 'vitest';
import {resizeAnchor} from '@renderer/features/presentation/grid/slideWindowAnchor';

const old = {tracks: 4, stride: 200, inset: 10};

describe('resizeAnchor', () => {
  it('keeps the live tile where it sat when it is in sight', () => {
    // NOTE(0913vision): Live tile 9 is in row 2 (top 410); the view starts at 300.
    const anchor = resizeAnchor(
      old,
      {tracks: 3, stride: 260, inset: 10},
      {top: 300, height: 600, live: 9, count: 40, rowGap: 8},
    );
    expect(anchor.index).toBe(9);
    expect(anchor.offset).toBe(110);
    // NOTE(0913vision): Row 3 of the new grid: 10 + 3 * 260 = 790, minus the offset.
    expect(anchor.target).toBe(680);
  });

  it('keeps the first tile in sight when the live tile is out of sight', () => {
    const anchor = resizeAnchor(
      old,
      {tracks: 2, stride: 300, inset: 10},
      {top: 1000, height: 500, live: 0, count: 40, rowGap: 8},
    );
    // NOTE(0913vision): ceil((1000 - 10) / 200) = 5 rows down, 4 per row.
    expect(anchor.index).toBe(20);
    expect(anchor.offset).toBe(10);
    expect(anchor.target).toBe(3000);
  });

  it('keeps a tile kept before, also across a second size change', () => {
    const anchor = resizeAnchor(
      {...old, anchor: {index: 5, offset: 40, target: 0}},
      {tracks: 5, stride: 150, inset: 10},
      {top: 0, height: 600, live: null, count: 40, rowGap: 8},
    );
    expect(anchor).toEqual({index: 5, offset: 40, target: 120});
  });

  it('never scrolls past the end of the grid', () => {
    const anchor = resizeAnchor(
      old,
      {tracks: 8, stride: 100, inset: 10},
      {top: 1600, height: 400, live: null, count: 40, rowGap: 8},
    );
    // NOTE(0913vision): 5 rows of 100, less the last gap, and the insets: 512 tall.
    expect(anchor.target).toBe(112);
  });
});
