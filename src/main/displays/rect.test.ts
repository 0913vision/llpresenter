import {describe, expect, it} from 'vitest';
import {centeredRect, intersectionArea, sameRect} from './rect';

describe('rect', () => {
  it('compares every side', () => {
    const rect = {x: 0, y: 0, width: 10, height: 20};
    expect(sameRect(rect, {...rect})).toBe(true);
    expect(sameRect(rect, {...rect, height: 21})).toBe(false);
  });

  it('measures the overlap of two rectangles, and zero when they only touch', () => {
    const left = {x: 0, y: 0, width: 100, height: 100};
    expect(
      intersectionArea(left, {x: 50, y: 50, width: 100, height: 100}),
    ).toBe(2500);
    expect(
      intersectionArea(left, {x: 100, y: 0, width: 100, height: 100}),
    ).toBe(0);
  });

  it('centers a size in an area and shrinks it to fit', () => {
    const area = {x: 1920, y: 0, width: 1920, height: 1040};
    expect(centeredRect(area, {width: 960, height: 540})).toEqual({
      x: 2400,
      y: 250,
      width: 960,
      height: 540,
    });
    expect(centeredRect(area, {width: 4000, height: 540})).toEqual({
      x: 1920,
      y: 250,
      width: 1920,
      height: 540,
    });
  });
});
