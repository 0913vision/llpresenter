import {expect, it} from 'vitest';
import {editFrame, resizeHandles} from '@core/canvas/frameEdit';
import {snapToGrid} from './gridSnap';

const frame = {x: 10, y: 15, w: 100, h: 80};
it('snaps moves in document pixels, including negative positions', () => {
  const delta = snapToGrid(
    frame,
    {x: 13, y: 7},
    {handle: 'move', keepRatio: false},
  ).delta;
  expect(editFrame(frame, delta, {handle: 'move'})).toEqual({
    ...frame,
    x: 20,
    y: 20,
  });
  const negative = snapToGrid(
    frame,
    {x: -25, y: -40},
    {handle: 'move', keepRatio: false},
  ).delta;
  expect(editFrame(frame, negative, {handle: 'move'})).toEqual({
    ...frame,
    x: -20,
    y: -20,
  });
});
it.each(resizeHandles)(
  'snaps moving edges of %s and preserves opposite edges',
  handle => {
    const {delta} = snapToGrid(
      frame,
      {x: 13, y: 7},
      {handle, keepRatio: false},
    );
    const next = editFrame(frame, delta, {handle});
    if (handle.includes('w')) {
      expect(next.x % 20).toBe(0);
      expect(next.x + next.w).toBe(110);
    }
    if (handle.includes('e')) {
      expect((next.x + next.w) % 20).toBe(0);
      expect(next.x).toBe(10);
    }
    if (handle.includes('n')) {
      expect(next.y % 20).toBe(0);
      expect(next.y + next.h).toBe(95);
    }
    if (handle.includes('s')) {
      expect((next.y + next.h) % 20).toBe(0);
      expect(next.y).toBe(15);
    }
  },
);
it.each(['nw', 'se'] as const)(
  'stops %s at a legal grid point when crossing its opposite corner',
  handle => {
    const amount = handle === 'nw' ? 1000 : -1000;
    const {delta} = snapToGrid(
      frame,
      {x: amount, y: amount},
      {handle, keepRatio: false},
    );
    const next = editFrame(frame, delta, {handle});
    expect(next.w).toBeGreaterThanOrEqual(20);
    expect(next.h).toBeGreaterThanOrEqual(20);
    expect((handle === 'nw' ? next.x : next.x + next.w) % 20).toBe(0);
    expect((handle === 'nw' ? next.y : next.y + next.h) % 20).toBe(0);
  },
);
it('keeps zero-distance clicks unchanged and ignores invalid input', () => {
  const zero = {x: 0, y: 0};
  expect(snapToGrid(frame, zero, {handle: 'se', keepRatio: true}).delta).toBe(
    zero,
  );
  const invalid = {x: Infinity, y: 3};
  expect(
    snapToGrid(frame, invalid, {handle: 'move', keepRatio: false}).delta,
  ).toBe(invalid);
});
it('chooses the dominant ratio axis even when the stationary axis is already on the grid', () => {
  const rect = {x: 0, y: 0, w: 400, h: 200};
  expect(
    snapToGrid(rect, {x: 31, y: 1}, {handle: 'se', keepRatio: true}),
  ).toEqual({delta: {x: 40, y: 0}, ratioAxis: 'x'});
  expect(
    snapToGrid(rect, {x: 1, y: 31}, {handle: 'se', keepRatio: true}),
  ).toEqual({delta: {x: 0, y: 40}, ratioAxis: 'y'});
});

it.each([
  {delta: {x: 31, y: 1}, w: 440, h: 220},
  {delta: {x: 1, y: 31}, w: 480, h: 240},
])(
  'resizes along the snapped dominant ratio axis for $delta',
  ({delta, w, h}) => {
    const rect = {x: 0, y: 0, w: 400, h: 200};
    const snapped = snapToGrid(rect, delta, {handle: 'se', keepRatio: true});
    const next = editFrame(rect, snapped.delta, {
      handle: 'se',
      keepRatio: true,
      ...(snapped.ratioAxis === undefined
        ? {}
        : {ratioAxis: snapped.ratioAxis}),
    });
    expect(next).toEqual({...rect, w, h});
  },
);
