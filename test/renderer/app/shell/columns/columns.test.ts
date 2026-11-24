import {describe, expect, it} from 'vitest';
import {
  CENTER_MIN_WIDTH,
  FIXED_GAPS_WIDTH,
  centerWidth,
  clamp,
  dragColumn,
  fitToWindow,
} from '@renderer/app/shell/columns/columns';

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
    expect(centerWidth(1920, {left: 280, right: 480, prepRight: 320})).toBe(
      1144,
    );
  });
});

describe('fitToWindow', () => {
  it('returns the saved widths when the center has room', () => {
    expect(fitToWindow({left: 280, right: 480, prepRight: 320}, 1920)).toEqual({
      left: 280,
      right: 480,
      prepRight: 320,
    });
  });

  it('keeps the widths when the center is exactly at its minimum', () => {
    const windowWidth = 400 + 720 + CENTER_MIN_WIDTH + FIXED_GAPS_WIDTH;
    expect(
      fitToWindow({left: 400, right: 720, prepRight: 320}, windowWidth),
    ).toEqual({
      left: 400,
      right: 720,
      prepRight: 320,
    });
  });

  it('shrinks the right column first by the missing amount', () => {
    const windowWidth = 400 + 720 + CENTER_MIN_WIDTH + FIXED_GAPS_WIDTH - 1;
    expect(
      fitToWindow({left: 400, right: 720, prepRight: 320}, windowWidth),
    ).toEqual({
      left: 400,
      right: 719,
      prepRight: 320,
    });
  });

  it('shrinks the left column only after the right one is at its minimum', () => {
    const rightAtMinimum = 400 + 320 + CENTER_MIN_WIDTH + FIXED_GAPS_WIDTH;
    expect(
      fitToWindow({left: 400, right: 720, prepRight: 320}, rightAtMinimum),
    ).toEqual({
      left: 400,
      right: 320,
      prepRight: 320,
    });
    expect(
      fitToWindow({left: 400, right: 720, prepRight: 320}, rightAtMinimum - 1),
    ).toEqual({
      left: 399,
      right: 320,
      prepRight: 320,
    });
  });

  it('stops at the minimum of both columns', () => {
    expect(fitToWindow({left: 400, right: 720, prepRight: 320}, 1000)).toEqual({
      left: 200,
      right: 320,
      prepRight: 280,
    });
  });

  it('clamps saved widths that are outside their ranges', () => {
    expect(
      fitToWindow({left: 100, right: 900, prepRight: 320}, WIDE_WINDOW_WIDTH),
    ).toEqual({
      left: 200,
      right: 720,
      prepRight: 320,
    });
  });

  it('fits every saved width into the smallest window', () => {
    const shown = fitToWindow(
      {left: 400, right: 720, prepRight: 320},
      MIN_WINDOW_WIDTH,
    );
    expect(centerWidth(MIN_WINDOW_WIDTH, shown)).toBeGreaterThanOrEqual(
      CENTER_MIN_WIDTH,
    );
  });

  it('does not change the saved widths', () => {
    const saved = Object.freeze({left: 400, right: 720, prepRight: 320});
    fitToWindow(saved, MIN_WINDOW_WIDTH);
    expect(saved).toEqual({left: 400, right: 720, prepRight: 320});
  });
});

describe('dragColumn', () => {
  const start = {left: 280, right: 480, prepRight: 320};
  const windowWidth = 1920;

  it('widens the left column when the gap moves right', () => {
    expect(
      dragColumn({
        column: 'left',
        start,
        delta: 20,
        windowWidth,
        right: 'right',
      }),
    ).toEqual({left: 300, right: 480, prepRight: 320});
  });

  it('widens the right column when its gap moves left', () => {
    expect(
      dragColumn({
        column: 'right',
        start,
        delta: -20,
        windowWidth,
        right: 'right',
      }),
    ).toEqual({left: 280, right: 500, prepRight: 320});
  });

  it('stops the left column at its range boundaries', () => {
    expect(
      dragColumn({
        column: 'left',
        start,
        delta: -1000,
        windowWidth,
        right: 'right',
      }).left,
    ).toBe(200);
    expect(
      dragColumn({
        column: 'left',
        start,
        delta: 1000,
        windowWidth,
        right: 'right',
      }).left,
    ).toBe(400);
  });

  it('stops the right column at its range boundaries', () => {
    expect(
      dragColumn({
        column: 'right',
        start,
        delta: 1000,
        windowWidth,
        right: 'right',
      }).right,
    ).toBe(320);
    expect(
      dragColumn({
        column: 'right',
        start,
        delta: -1000,
        windowWidth,
        right: 'right',
      }).right,
    ).toBe(720);
  });

  it('stops widening once the center reaches its minimum', () => {
    const narrow = 1280;
    const shown = {left: 220, right: 360, prepRight: 320};
    const dragged = dragColumn({
      column: 'left',
      start: shown,
      delta: 500,
      windowWidth: narrow,
      right: 'right',
    });
    expect(dragged).toEqual({left: 344, right: 360, prepRight: 320});
    expect(centerWidth(narrow, dragged)).toBe(CENTER_MIN_WIDTH);
  });

  it('keeps the other column where it was', () => {
    const dragged = dragColumn({
      column: 'right',
      start,
      delta: -50,
      windowWidth,
      right: 'right',
    });
    expect(dragged.left).toBe(start.left);
  });

  it('never goes under the column minimum when the window leaves no room', () => {
    const tight = {left: 200, right: 320, prepRight: 320};
    const dragged = dragColumn({
      column: 'left',
      start: tight,
      delta: 100,
      windowWidth: MIN_WINDOW_WIDTH - 200,
      right: 'right',
    });
    expect(dragged.left).toBe(200);
  });
});

describe('the right column of 준비', () => {
  it('is dragged beside its own center', () => {
    const start = {left: 280, right: 480, prepRight: 320};
    expect(
      dragColumn({
        column: 'prepRight',
        start,
        delta: -60,
        windowWidth: 1920,
        right: 'prepRight',
      }),
    ).toEqual({...start, prepRight: 380});
  });

  it('leaves the left column the room that it has beside it', () => {
    const start = {left: 300, right: 720, prepRight: 320};
    const windowWidth = 300 + 320 + CENTER_MIN_WIDTH + FIXED_GAPS_WIDTH + 50;
    const drag = {column: 'left', start, delta: 200, windowWidth} as const;
    expect(dragColumn({...drag, right: 'prepRight'}).left).toBe(350);
    expect(dragColumn({...drag, right: 'right'}).left).toBe(200);
  });
});
