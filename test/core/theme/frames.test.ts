import {describe, expect, it} from 'vitest';
import type {
  OwnThemeScreen,
  ThemeElement,
  ThemeFrame,
} from '@core/schema/screens/theme';
import {roundGeometryValue} from '@core/canvas/geometryValue';
import {BUILT_IN_THEMES} from '@core/theme/builtIn';
import {
  changeSplit,
  changeStack,
  drawnFrame,
  moveElement,
  splitOf,
  stackOf,
} from '@core/theme/frames';

/** Every screen of the app's themes that draws its own elements. */
const SCREENS: readonly OwnThemeScreen[] = BUILT_IN_THEMES.flatMap(theme =>
  Object.values(theme.screens).flatMap(screen =>
    screen.mode === 'own' ? [screen] : [],
  ),
);

/** A screen of the app's themes with an element that `matches`. */
function screenWith(
  matches: (element: ThemeElement, screen: OwnThemeScreen) => boolean,
): {readonly screen: OwnThemeScreen; readonly element: ThemeElement} {
  for (const screen of SCREENS) {
    const element = screen.elements.find(entry => matches(entry, screen));
    if (element !== undefined) return {screen, element};
  }
  throw new Error('No such screen');
}

function down(frame: ThemeFrame, by: number): ThemeFrame {
  return {...frame, y: frame.y + by};
}

function elementOf(screen: OwnThemeScreen | undefined, id: string) {
  return screen?.elements.find(entry => entry.id === id);
}

describe('moveElement', () => {
  it('puts a free element where it was dragged, rounded as frames are and at least one pixel', () => {
    const {screen, element} = screenWith(
      (entry, own) =>
        (entry.kind === 'text' || entry.kind === 'picture') &&
        stackOf(own, entry.id) === undefined &&
        splitOf(own, entry.id) === undefined,
    );
    const moved = moveElement(screen, element.id, {
      from: element.frame,
      to: {x: 10.123, y: 20.678, w: 0.2, h: 300},
    });
    expect(elementOf(moved, element.id)?.frame).toMatchObject({
      x: roundGeometryValue(10.123),
      y: roundGeometryValue(20.678),
      w: 1,
      h: 300,
    });
  });

  it('moves the stack of a stacked text, and changes its height only when it was resized', () => {
    const {screen, element} = screenWith(
      (entry, own) => stackOf(own, entry.id) !== undefined,
    );
    const stack = stackOf(screen, element.id);
    const moved = moveElement(screen, element.id, {
      from: element.frame,
      to: down(element.frame, 40),
    });
    expect(
      moved === undefined ? undefined : stackOf(moved, element.id)?.at,
    ).toBe((stack?.at ?? 0) + 40);
    expect(elementOf(moved, element.id)?.frame.h).toBe(element.frame.h);
  });

  it('moves the part of a split that was dragged', () => {
    const {screen, element} = screenWith(
      (entry, own) => splitOf(own, entry.id)?.lower === entry.id,
    );
    const split = splitOf(screen, element.id);
    const lower = moveElement(screen, element.id, {
      from: element.frame,
      to: down(element.frame, 25),
    });
    expect(
      lower === undefined ? undefined : splitOf(lower, element.id)?.at,
    ).toBe((split?.at ?? 0) + 25);
    const upperId = split?.upper[0] ?? '';
    const upper = elementOf(screen, upperId);
    if (upper === undefined) throw new Error('No upper text');
    const moved = moveElement(screen, upperId, {
      from: upper.frame,
      to: down(upper.frame, -15),
    });
    expect(moved === undefined ? undefined : splitOf(moved, upperId)?.top).toBe(
      (split?.top ?? 0) - 15,
    );
  });

  it('keeps a shape around texts reaching them, moving its padding with the drag', () => {
    const {screen, element} = screenWith(
      entry => entry.kind === 'shape' && entry.around !== undefined,
    );
    if (element.kind !== 'shape' || element.around === undefined) {
      throw new Error('No shape around texts');
    }
    const moved = elementOf(
      moveElement(screen, element.id, {
        from: element.frame,
        to: down(element.frame, 10),
      }),
      element.id,
    );
    expect(
      moved?.kind === 'shape' ? moved.around?.padding.top : undefined,
    ).toBe(element.around.padding.top - 10);
  });

  it('keeps a shape beside texts at its side, moving its gap with the drag', () => {
    const {screen, element} = screenWith(
      entry => entry.kind === 'shape' && entry.beside !== undefined,
    );
    if (element.kind !== 'shape' || element.beside === undefined) {
      throw new Error('No shape beside texts');
    }
    const moved = elementOf(
      moveElement(screen, element.id, {
        from: element.frame,
        to: down(element.frame, 10),
      }),
      element.id,
    );
    const gap = moved?.kind === 'shape' ? moved.beside?.gap : undefined;
    expect(gap).toBe(
      element.beside.gap + (element.beside.side === 'above' ? -10 : 10),
    );
  });

  it('moves nothing it does not know', () => {
    const [screen] = SCREENS;
    if (screen === undefined) throw new Error('No screen');
    expect(
      moveElement(screen, 'gone', {
        from: {x: 0, y: 0, w: 1, h: 1},
        to: {x: 1, y: 1, w: 1, h: 1},
      }),
    ).toBeUndefined();
  });
});

describe('drawnFrame', () => {
  it('draws a stacked text where its stack puts it, and a free one at its own frame', () => {
    const stacked = screenWith(
      (entry, own) => stackOf(own, entry.id) !== undefined,
    );
    const placed = {x: 1, y: 2, w: 3, h: 4, size: 60, keepRows: false};
    expect(
      drawnFrame(stacked.screen, stacked.element, {
        texts: new Map([[stacked.element.id, placed]]),
        shapes: new Map(),
      }),
    ).toMatchObject({x: 1, y: 2, w: 3, h: 4});
    expect(
      drawnFrame(stacked.screen, stacked.element, {
        texts: new Map(),
        shapes: new Map(),
      }),
    ).toEqual(stacked.element.frame);
  });
});

describe('drawnFrame of other elements', () => {
  it('draws a shape where the layout placed it, else at its own frame', () => {
    const {screen, element} = screenWith(entry => entry.kind === 'shape');
    const placed = {x: 5, y: 6, w: 7, h: 8};
    expect(
      drawnFrame(screen, element, {
        texts: new Map(),
        shapes: new Map([[element.id, placed]]),
      }),
    ).toEqual({...element.frame, ...placed});
    expect(
      drawnFrame(screen, element, {texts: new Map(), shapes: new Map()}),
    ).toEqual(element.frame);
  });

  it('draws a free text and a picture or background at their own frames, whatever the layout says', () => {
    const free = screenWith(
      (entry, own) =>
        entry.kind === 'text' &&
        stackOf(own, entry.id) === undefined &&
        splitOf(own, entry.id) === undefined,
    );
    const other = screenWith(
      entry => entry.kind === 'background' || entry.kind === 'picture',
    );
    const elsewhere = {x: 1, y: 2, w: 3, h: 4, size: 60, keepRows: false};
    for (const {screen, element} of [free, other]) {
      expect(
        drawnFrame(screen, element, {
          texts: new Map([[element.id, elsewhere]]),
          shapes: new Map(),
        }),
      ).toEqual(element.frame);
    }
  });
});

describe('changeStack and changeSplit', () => {
  it('change the stack or split of a text, and nothing for a text in none', () => {
    const {screen, element} = screenWith(
      (entry, own) => stackOf(own, entry.id) !== undefined,
    );
    const changed = changeStack(screen, element.id, {gap: 99});
    expect(stackOf(changed, element.id)?.gap).toBe(99);
    expect(changeStack(screen, 'gone', {gap: 1})).toBe(screen);
    expect(changeSplit(screen, 'gone', {gap: 1})).toBe(screen);
  });
});
