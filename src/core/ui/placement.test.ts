import {describe, expect, it} from 'vitest';
import {
  maxPopoverHeight,
  menuChainShift,
  placeAtPoint,
  placeBelow,
  placeSubmenu,
  placeTooltip,
} from './placement';

const viewport = {width: 1280, height: 720};

describe('placeTooltip', () => {
  it('centers the tooltip 6px below a small target', () => {
    const target = {left: 100, top: 100, width: 26, height: 26};
    expect(placeTooltip(target, {width: 60, height: 26}, viewport)).toEqual({
      x: 83,
      y: 132,
    });
  });

  it('aligns left edges when the target is wider than the tooltip', () => {
    const field = {left: 100, top: 100, width: 300, height: 30};
    expect(placeTooltip(field, {width: 200, height: 26}, viewport).x).toBe(100);
  });

  it('flips above when there is no room below', () => {
    const target = {left: 100, top: 690, width: 26, height: 26};
    expect(placeTooltip(target, {width: 60, height: 26}, viewport).y).toBe(658);
  });

  it('keeps 8px from the side edges', () => {
    const atLeft = {left: 0, top: 100, width: 10, height: 10};
    const atRight = {left: 1275, top: 100, width: 5, height: 10};
    const tip = {width: 100, height: 26};
    expect(placeTooltip(atLeft, tip, viewport).x).toBe(8);
    expect(placeTooltip(atRight, tip, viewport).x).toBe(1172);
  });
});

describe('placeBelow', () => {
  it('opens 4px below the button with left edges aligned', () => {
    const button = {left: 200, top: 40, width: 120, height: 26};
    expect(placeBelow(button, {width: 180, height: 200}, viewport)).toEqual({
      x: 200,
      y: 70,
    });
  });

  it('opens 4px above when there is no room below', () => {
    const button = {left: 200, top: 600, width: 120, height: 26};
    expect(placeBelow(button, {width: 180, height: 200}, viewport).y).toBe(396);
  });

  it('stays inside the window when it fits neither below nor above', () => {
    const button = {left: 200, top: 300, width: 120, height: 26};
    expect(placeBelow(button, {width: 180, height: 700}, viewport).y).toBe(12);
  });
});

describe('placeAtPoint', () => {
  it('puts the top-left corner at the pointer', () => {
    expect(
      placeAtPoint({x: 300, y: 200}, {width: 240, height: 150}, viewport),
    ).toEqual({x: 300, y: 200});
  });

  it('flips left and up near the right and bottom edges', () => {
    expect(
      placeAtPoint({x: 1200, y: 650}, {width: 240, height: 150}, viewport),
    ).toEqual({x: 960, y: 500});
  });
});

describe('placeSubmenu', () => {
  const menu = {left: 100, top: 50, width: 200, height: 300};
  const item = {left: 106, top: 90, width: 188, height: 28};

  it('opens beside the parent and lines up the first item', () => {
    expect(
      placeSubmenu({item, menu}, {width: 180, height: 120}, viewport),
    ).toEqual({x: 300, y: 84});
  });

  it('opens on the left when there is no room on the right', () => {
    const farRight = {left: 1000, top: 50, width: 200, height: 300};
    expect(
      placeSubmenu({item, menu: farRight}, {width: 180, height: 120}, viewport)
        .x,
    ).toBe(820);
  });

  it.each([
    {left: 800, ancestorLeft: 1000, windowWidth: 1280},
    {left: 400, ancestorLeft: 200, windowWidth: 700},
    {left: 100, ancestorLeft: 300, windowWidth: 700},
  ])(
    'never covers an ancestor or parent at $left in a $windowWidth window',
    ({left, ancestorLeft, windowWidth}) => {
      const parent = {...menu, left};
      const ancestor = {...menu, left: ancestorLeft};
      const width = 180;
      const placed = placeSubmenu(
        {item, menu: parent, ancestors: [ancestor]},
        {width, height: 120},
        {width: windowWidth, height: 720},
      );
      for (const box of [parent, ancestor]) {
        expect(
          placed.x + width <= box.left || placed.x >= box.left + box.width,
        ).toBe(true);
      }
    },
  );
});

describe('maxPopoverHeight', () => {
  it('leaves 8px at the top and bottom of the window', () => {
    expect(maxPopoverHeight(viewport)).toBe(704);
  });
});

it('fits a menu chain as a whole without changing the distance between menus', () => {
  const boxes = [1000, 1200, 1400].map(left => ({
    left,
    top: 100,
    width: 200,
    height: 150,
  }));
  expect(menuChainShift(boxes, viewport)).toBe(-328);
  expect(menuChainShift(boxes, {width: 500, height: 720})).toBe(0);
});
