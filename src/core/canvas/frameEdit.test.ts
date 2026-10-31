import {describe, expect, it} from 'vitest';
import {
  editFrame,
  editFrameValue,
  frameWithinBounds,
  resizeHandles,
  containFrameGesture,
} from './frameEdit';

const frame = {x: 10, y: 20, w: 100, h: 80};
it.each([
  {
    handle: 'se',
    frame: {x: 100, y: 100, w: 4000, h: 2000},
    expected: {x: 100, y: 100, w: 1820, h: 910},
  },
  {
    handle: 'nw',
    frame: {x: -3500, y: -1700, w: 4000, h: 2000},
    expected: {x: 0, y: 50, w: 500, h: 250},
  },
  {
    handle: 'e',
    frame: {x: 100, y: -800, w: 4000, h: 2000},
    expected: {x: 100, y: 0, w: 800, h: 400},
  },
] as const)(
  'preserves ratio and resize anchors for bounded $handle gestures',
  ({handle, frame, expected}) => {
    const result = containFrameGesture(frame, {
      start: {x: 100, y: 100, w: 400, h: 200},
      handle,
      keepRatio: true,
      bounds: {width: 1920, height: 1080, minimumSize: 8},
    });
    expect(result).toMatchObject(expected);
    expect(result.w / result.h).toBe(2);
  },
);
it('clips free resize edges and slides moves without shrinking their frame', () => {
  const start = {x: 100, y: 100, w: 400, h: 200};
  const context = {
    start,
    keepRatio: false,
    bounds: {width: 1920, height: 1080, minimumSize: 8},
  };
  expect(
    containFrameGesture(
      {x: -50, y: -25, w: 550, h: 325},
      {...context, handle: 'nw'},
    ),
  ).toMatchObject({x: 0, y: 0, w: 500, h: 300});
  expect(
    containFrameGesture(
      {...start, x: 1900, y: -25},
      {...context, handle: 'move'},
    ),
  ).toMatchObject({x: 1520, y: 0, w: 400, h: 200});
});
it('supports a caller minimum and bounds the complete frame without dropping extensions', () => {
  expect(
    editFrame(frame, {x: -200, y: -200}, {handle: 'se', minimumSize: 8}),
  ).toMatchObject({w: 8, h: 8});
  expect(
    editFrameValue(
      frame,
      {field: 'w', value: 8},
      {width: 1920, height: 1080, minimumSize: 8},
    ),
  ).toMatchObject({w: 8});
  expect(
    frameWithinBounds(
      {...frame, future: 1, x: 2000, y: -20},
      {width: 1920, height: 1080, minimumSize: 8},
    ),
  ).toEqual({...frame, future: 1, x: 1820, y: 0});
});
describe('canvas geometry', () => {
  it.each(resizeHandles)(
    'resizes %s while preserving the opposite edges',
    handle => {
      const next = editFrame(frame, {x: 15, y: 25}, {handle});
      expect(next.x).toBe(handle.includes('w') ? 25 : 10);
      expect(next.y).toBe(handle.includes('n') ? 45 : 20);
      expect(next.w).toBe(
        handle.includes('w') ? 85 : handle.includes('e') ? 115 : 100,
      );
      expect(next.h).toBe(
        handle.includes('n') ? 55 : handle.includes('s') ? 105 : 80,
      );
    },
  );
  it('moves in whole reference pixels including negative positions', () => {
    expect(editFrame(frame, {x: -30.2, y: 10.1}, {handle: 'move'})).toEqual({
      ...frame,
      x: -20,
      y: 30,
    });
  });
  it.each(resizeHandles)(
    'keeps the ratio and opposite anchor with handle %s',
    handle => {
      const next = editFrame(frame, {x: 20, y: 16}, {handle, keepRatio: true});
      expect(next.w / next.h).toBeCloseTo(frame.w / frame.h, 2);
      if (handle.includes('w')) expect(next.x + next.w).toBe(frame.x + frame.w);
      if (handle.includes('e')) expect(next.x).toBe(frame.x);
      if (handle.includes('n')) expect(next.y + next.h).toBe(frame.y + frame.h);
      if (handle.includes('s')) expect(next.y).toBe(frame.y);
      if (handle === 'n' || handle === 's') {
        expect(next.x + next.w / 2).toBe(frame.x + frame.w / 2);
      }
      if (handle === 'e' || handle === 'w') {
        expect(next.y + next.h / 2).toBe(frame.y + frame.h / 2);
      }
    },
  );
  it('uses the dominant corner change, preserves metadata, and handles zero-sized imported boxes', () => {
    const extended = {...frame, future: 1};
    expect(
      editFrame(extended, {x: 5, y: 40}, {handle: 'se', keepRatio: true}),
    ).toMatchObject({
      x: 10,
      y: 20,
      w: 150,
      h: 120,
      future: 1,
    });
    const tiny = editFrame(
      frame,
      {x: 1000, y: 1000},
      {handle: 'nw', keepRatio: true},
    );
    expect(tiny.w).toBeGreaterThanOrEqual(20);
    expect(tiny.h).toBeGreaterThanOrEqual(20);
    expect(tiny.x + tiny.w).toBe(frame.x + frame.w);
    expect(tiny.y + tiny.h).toBe(frame.y + frame.h);
    expect(
      editFrame(
        {...frame, w: 0},
        {x: 10, y: 10},
        {handle: 'se', keepRatio: true},
      ),
    ).toMatchObject({w: 20, h: 90});
    expect(
      editFrame(frame, {x: 20, y: 10}, {handle: 'move', keepRatio: true}),
    ).toEqual(editFrame(frame, {x: 20, y: 10}, {handle: 'move'}));
  });
  it('couples numeric dimensions at the same origin and caps the pair together', () => {
    const bounds = {width: 1920, height: 1080};
    expect(
      editFrameValue(frame, {field: 'w', value: 200, keepRatio: true}, bounds),
    ).toEqual({...frame, w: 200, h: 160});
    expect(
      editFrameValue(frame, {field: 'h', value: 120, keepRatio: true}, bounds),
    ).toEqual({...frame, w: 150, h: 120});
    expect(
      editFrameValue(frame, {field: 'x', value: 60, keepRatio: true}, bounds),
    ).toEqual({...frame, x: 60});
    expect(
      editFrameValue(
        {x: 10, y: 20, w: 400, h: 200},
        {field: 'w', value: 20, keepRatio: true},
        bounds,
      ),
    ).toEqual({x: 10, y: 20, w: 40, h: 20});
    const small = {width: 192, height: 100};
    const capped = editFrameValue(
      frame,
      {field: 'w', value: 192, keepRatio: true},
      small,
    );
    expect(capped).toEqual({...frame, w: 125, h: 100});
    expect(
      editFrameValue(capped, {field: 'w', value: 192, keepRatio: true}, small),
    ).toBe(capped);
    expect(
      editFrameValue(frame, {field: 'w', value: NaN, keepRatio: true}, bounds),
    ).toBe(frame);
  });
  it('prevents flipping and rejects nonfinite input', () => {
    expect(editFrame(frame, {x: 1000, y: 1000}, {handle: 'nw'})).toEqual({
      x: 90,
      y: 80,
      w: 20,
      h: 20,
    });
    expect(editFrame(frame, {x: -1000, y: -1000}, {handle: 'se'})).toEqual({
      ...frame,
      w: 20,
      h: 20,
    });
    expect(editFrame(frame, {x: Infinity, y: 0}, {handle: 'move'})).toBe(frame);
  });
  it('uses the same minimum for typed and dragged width and height', () => {
    const bounds = {width: 1920, height: 1080};
    const dragged = editFrame(frame, {x: -500, y: -500}, {handle: 'se'});
    expect(dragged.w).toBe(
      editFrameValue(frame, {field: 'w', value: 1}, bounds).w,
    );
    expect(dragged.h).toBe(
      editFrameValue(frame, {field: 'h', value: 1}, bounds).h,
    );
    expect(dragged).toMatchObject({w: 20, h: 20});
  });
});
