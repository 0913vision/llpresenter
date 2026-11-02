import {describe, expect, it} from 'vitest';
import {
  libraryRectOnScreen,
  orderEditorPlacement,
} from '@main/windows/orderEditorPlacement';

const AREA = {x: 0, y: 0, width: 1920, height: 1040};
const LIBRARY = {x: 0, y: 90, width: 300, height: 900};

describe('orderEditorPlacement', () => {
  it('opens at the library right edge and top, with the saved size', () => {
    expect(
      orderEditorPlacement({
        saved: {x: 900, y: 40, width: 1000, height: 700},
        library: LIBRARY,
        area: AREA,
      }),
    ).toEqual({x: 300, y: 90, width: 1000, height: 700});
  });

  it('takes the library height when nothing is saved', () => {
    expect(orderEditorPlacement({library: LIBRARY, area: AREA})).toMatchObject({
      x: 300,
      y: 90,
      width: 1100,
      height: 900,
    });
  });

  it('keeps the window inside the work area', () => {
    expect(
      orderEditorPlacement({
        saved: {x: 0, y: 0, width: 1800, height: 1000},
        library: LIBRARY,
        area: AREA,
      }),
    ).toEqual({x: 120, y: 40, width: 1800, height: 1000});
  });

  it('falls back to the saved place, then to the center, without a library', () => {
    expect(
      orderEditorPlacement({
        saved: {x: 50, y: 60, width: 800, height: 600},
        library: null,
        area: AREA,
      }),
    ).toEqual({x: 50, y: 60, width: 800, height: 600});
    expect(orderEditorPlacement({library: null, area: AREA})).toMatchObject({
      x: 410,
      y: 52,
    });
  });

  it('never shrinks below the minimum size', () => {
    expect(
      orderEditorPlacement({
        saved: {x: 0, y: 0, width: 10, height: 10},
        library: null,
        area: AREA,
      }),
    ).toMatchObject({width: 640, height: 480});
  });
});

describe('libraryRectOnScreen', () => {
  const origin = {x: 10, y: 20};

  it('moves the page rectangle to screen pixels with the zoom factor', () => {
    const reply = JSON.stringify({left: 0, top: 50, right: 200, bottom: 450});
    expect(libraryRectOnScreen(reply, origin, 1.5)).toEqual({
      x: 10,
      y: 95,
      width: 300,
      height: 600,
    });
  });

  it.each([
    ['not a string', 7],
    ['null', 'null'],
    ['not JSON', '{'],
    ['wrong fields', JSON.stringify({left: 'a'})],
    ['empty', JSON.stringify({left: 5, top: 5, right: 5, bottom: 9})],
  ])('answers null for %s', (_name, reply) => {
    expect(libraryRectOnScreen(reply, origin, 1)).toBeNull();
  });
});
