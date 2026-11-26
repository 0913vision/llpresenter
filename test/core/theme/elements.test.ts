import {describe, expect, it} from 'vitest';
import {BUILT_IN_THEME_IDS} from '@core/theme/builtIn/ids';
import {
  THEME_FILE_LIMITS,
  type OwnThemeScreen,
  type ThemeElement,
} from '@core/schema/screens/theme';
import {
  canAddElement,
  changeElement,
  newElement,
  parseElements,
  pasteElements,
  removeElements,
  restackElements,
  serializeElements,
} from '@core/theme/elements';
import {moveElement} from '@core/theme/frames';
import {builtIn} from '@fixtures/core/themeOutput';

function titleScreen(): OwnThemeScreen {
  const screen = builtIn(BUILT_IN_THEME_IDS.title).screens.audience;
  if (screen.mode !== 'own') throw new Error('Not its own');
  return screen;
}

function ids(screen: OwnThemeScreen) {
  return screen.elements.map(element => element.id);
}

describe('the elements of a screen', () => {
  it('leave their stack when they are removed', () => {
    const screen = titleScreen();
    const stacked = screen.stacks?.[0]?.texts[0];
    if (stacked === undefined) throw new Error('No stack');
    const without = removeElements(screen, new Set([stacked]));
    expect(ids(without)).not.toContain(stacked);
    expect(JSON.stringify(without)).not.toContain(stacked);
  });

  it('come to the front and go to the back', () => {
    const screen = titleScreen();
    const [first] = ids(screen);
    if (first === undefined) throw new Error('No element');
    const front = restackElements(screen, new Set([first]), 'front');
    expect(ids(front).at(-1)).toBe(first);
    expect(ids(restackElements(front, new Set([first]), 'back'))[0]).toBe(
      first,
    );
  });

  it('have one background and one next text at most', () => {
    const screen = titleScreen();
    expect(canAddElement(screen, 'background')).toBe(false);
    expect(canAddElement(screen, 'text')).toBe(true);
  });

  it('are pasted with ids of their own', () => {
    const screen = titleScreen();
    const texts = screen.elements.filter(element => element.kind === 'text');
    const copied = parseElements(serializeElements(texts));
    expect(copied).toEqual(texts);
    const pasted = pasteElements(screen, copied ?? []);
    expect(pasted?.ids).toHaveLength(texts.length);
    expect(ids(screen)).not.toEqual(
      expect.arrayContaining([...(pasted?.ids ?? [])]),
    );
    expect(parseElements('not elements')).toBeNull();
  });

  it('are pasted naming each other by their new ids, and drop what names a text left behind', () => {
    const screen = titleScreen();
    const text = newElement('text');
    const shape = newElement('shape');
    const next = newElement('next');
    if (
      text === undefined ||
      shape?.kind !== 'shape' ||
      next?.kind !== 'next'
    ) {
      throw new Error('No elements');
    }
    const around: ThemeElement = {
      ...shape,
      around: {texts: [text.id], padding: {top: 10, bottom: 10}},
    };
    const following: ThemeElement = {...next, of: text.id, ratio: 50};
    const together = pasteElements(screen, [text, around, following]);
    const [newText, newShape, newNext] =
      together?.screen.elements.slice(-3) ?? [];
    expect(newText?.id).not.toBe(text.id);
    expect(newShape).toMatchObject({around: {texts: [newText?.id]}});
    expect(newNext).toMatchObject({of: newText?.id, ratio: 50});

    const alone = pasteElements(screen, [around, following]);
    const [lonelyShape, lonelyNext] = alone?.screen.elements.slice(-2) ?? [];
    expect(lonelyShape).not.toHaveProperty('around');
    expect(lonelyNext).not.toHaveProperty('of');
    expect(lonelyNext).not.toHaveProperty('ratio');
  });

  it('are not pasted when the screen has its one background already or no room is left', () => {
    const screen = titleScreen();
    const background = newElement('background');
    if (background === undefined) throw new Error('No background');
    expect(pasteElements(screen, [background])).toBeNull();
    const room = THEME_FILE_LIMITS.elements - screen.elements.length;
    const texts = Array.from({length: room + 1}, () => newElement('text'));
    const fitting = texts.filter(
      (element): element is ThemeElement => element !== undefined,
    );
    expect(pasteElements(screen, fitting.slice(0, room))).not.toBeNull();
    expect(pasteElements(screen, fitting)).toBeNull();
  });

  it('are kept when a change of them is not valid', () => {
    const screen = titleScreen();
    const [first] = ids(screen);
    expect(
      changeElement(screen, first ?? '', element => ({
        ...element,
        frame: {...element.frame, w: -1},
      })),
    ).toBeUndefined();
  });

  it('move their stack when one of it is dragged', () => {
    const screen = titleScreen();
    const stack = screen.stacks?.[0];
    const id = stack?.texts[0];
    const element = screen.elements.find(entry => entry.id === id);
    if (stack === undefined || element === undefined) {
      throw new Error('No stack');
    }
    const from = element.frame;
    const moved = moveElement(screen, element.id, {
      from,
      to: {...from, y: from.y + 30},
    });
    expect(moved?.stacks?.[0]?.at).toBe(stack.at + 30);
  });
});
