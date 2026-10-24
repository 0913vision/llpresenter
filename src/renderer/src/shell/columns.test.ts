import {describe, expect, it} from 'vitest';
import {
  CENTER_MIN_WIDTH,
  FIXED_GAPS_WIDTH,
  centerWidth,
  clamp,
  dragColumn,
  fitToWindow,
} from './columns';

const MIN_WINDOW_WIDTH = 1280;
const WIDE_WINDOW_WIDTH = 2560;

describe('clamp', () => {
  const range = {min: 200, max: 400};

  it('keeps values on the range boundaries', () => {
    expect(clamp(200, range)).toBe(200);
    expect(clamp(400, range)).toBe(400);
  });

  it('pulls values outside the range to the nearest boundary', () => {
    expect(clamp(199, range)).toBe(200);
    expect(clamp(401, range)).toBe(400);
  });
});

describe('centerWidth', () => {
  it('subtracts the columns and the four gaps from the window', () => {
    expect(FIXED_GAPS_WIDTH).toBe(16);
    expect(centerWidth(1920, {left: 280, right: 480})).toBe(1144);
  });

  it('leaves 744 in the smallest window with both columns at minimum', () => {
    expect(centerWidth(MIN_WINDOW_WIDTH, {left: 200, right: 320})).toBe(744);
  });
});

describe('fitToWindow', () => {
  it('returns the saved widths when the center has room', () => {
    expect(fitToWindow({left: 280, right: 480}, 1920)).toEqual({
      left: 280,
      right: 480,
    });
  });

  it('keeps the widths when the center is exactly at its minimum', () => {
    const windowWidth = 400 + 720 + CENTER_MIN_WIDTH + FIXED_GAPS_WIDTH;
    expect(fitToWindow({left: 400, right: 720}, windowWidth)).toEqual({
      left: 400,
      right: 720,
    });
  });

  it('shrinks the right column first by the missing amount', () => {
    const windowWidth = 400 + 720 + CENTER_MIN_WIDTH + FIXED_GAPS_WIDTH - 1;
    expect(fitToWindow({left: 400, right: 720}, windowWidth)).toEqual({
      left: 400,
      right: 719,
    });
  });

  it('shrinks the left column only after the right one is at its minimum', () => {
    const rightAtMinimum = 400 + 320 + CENTER_MIN_WIDTH + FIXED_GAPS_WIDTH;
    expect(fitToWindow({left: 400, right: 720}, rightAtMinimum)).toEqual({
      left: 400,
      right: 320,
    });
    expect(fitToWindow({left: 400, right: 720}, rightAtMinimum - 1)).toEqual({
      left: 399,
      right: 320,
    });
  });

  it('stops at the minimum of both columns', () => {
    expect(fitToWindow({left: 400, right: 720}, 1000)).toEqual({
      left: 200,
      right: 320,
    });
  });

  it('clamps saved widths that are outside their ranges', () => {
    expect(fitToWindow({left: 100, right: 900}, WIDE_WINDOW_WIDTH)).toEqual({
      left: 200,
      right: 720,
    });
  });

  it('fits every saved width into the smallest window', () => {
    const shown = fitToWindow({left: 400, right: 720}, MIN_WINDOW_WIDTH);
    expect(centerWidth(MIN_WINDOW_WIDTH, shown)).toBeGreaterThanOrEqual(
      CENTER_MIN_WIDTH,
    );
  });

  it('does not change the saved widths', () => {
    const saved = Object.freeze({left: 400, right: 720});
    fitToWindow(saved, MIN_WINDOW_WIDTH);
    expect(saved).toEqual({left: 400, right: 720});
  });
});

describe('dragColumn', () => {
  const start = {left: 280, right: 480};
  const windowWidth = 1920;

  it('widens the left column when the gap moves right', () => {
    expect(dragColumn({column: 'left', start, delta: 20, windowWidth})).toEqual(
      {left: 300, right: 480},
    );
  });

  it('widens the right column when its gap moves left', () => {
    expect(
      dragColumn({column: 'right', start, delta: -20, windowWidth}),
    ).toEqual({left: 280, right: 500});
  });

  it('stops the left column at its range boundaries', () => {
    expect(
      dragColumn({column: 'left', start, delta: -1000, windowWidth}).left,
    ).toBe(200);
    expect(
      dragColumn({column: 'left', start, delta: 1000, windowWidth}).left,
    ).toBe(400);
  });

  it('stops the right column at its range boundaries', () => {
    expect(
      dragColumn({column: 'right', start, delta: 1000, windowWidth}).right,
    ).toBe(320);
    expect(
      dragColumn({column: 'right', start, delta: -1000, windowWidth}).right,
    ).toBe(720);
  });

  it('stops widening once the center reaches its minimum', () => {
    const narrow = 1280;
    const shown = {left: 220, right: 360};
    const dragged = dragColumn({
      column: 'left',
      start: shown,
      delta: 500,
      windowWidth: narrow,
    });
    expect(dragged).toEqual({left: 344, right: 360});
    expect(centerWidth(narrow, dragged)).toBe(CENTER_MIN_WIDTH);
  });

  it('keeps the other column where it was', () => {
    const dragged = dragColumn({
      column: 'right',
      start,
      delta: -50,
      windowWidth,
    });
    expect(dragged.left).toBe(start.left);
  });

  it('never goes under the column minimum when the window leaves no room', () => {
    const tight = {left: 200, right: 320};
    const dragged = dragColumn({
      column: 'left',
      start: tight,
      delta: 100,
      windowWidth: MIN_WINDOW_WIDTH - 200,
    });
    expect(dragged.left).toBe(200);
  });
});
