import {describe, expect, it} from 'vitest';
import {createMediaId} from '@core/schema/common/ids';
import type {OwnThemeScreen, ThemeElement} from '@core/schema/screens/theme';
import {BUILT_IN_THEMES} from '@core/theme/builtIn';
import {
  newElement,
  parseElements,
  pasteElements,
  removeElements,
  restackElements,
} from '@core/theme/elements';
import {splitOf} from '@core/theme/frames';

const SCREENS: readonly OwnThemeScreen[] = BUILT_IN_THEMES.flatMap(theme =>
  Object.values(theme.screens).flatMap(screen =>
    screen.mode === 'own' ? [screen] : [],
  ),
);

function screenWith(
  matches: (element: ThemeElement, screen: OwnThemeScreen) => boolean,
): {readonly screen: OwnThemeScreen; readonly element: ThemeElement} {
  for (const screen of SCREENS) {
    const element = screen.elements.find(entry => matches(entry, screen));
    if (element !== undefined) return {screen, element};
  }
  throw new Error('No such screen');
}

function ids(screen: OwnThemeScreen): string[] {
  return screen.elements.map(element => element.id);
}

describe('removeElements', () => {
  it('drops a split whose lower text goes, and keeps it while an upper text stays', () => {
    const {screen, element} = screenWith(
      (entry, own) => splitOf(own, entry.id)?.lower === entry.id,
    );
    const split = splitOf(screen, element.id);
    expect(
      splitOf(removeElements(screen, new Set([element.id])), element.id),
    ).toBe(undefined);
    const [firstUpper] = split?.upper ?? [];
    if (firstUpper === undefined) throw new Error('No upper text');
    const kept = removeElements(screen, new Set([firstUpper]));
    const after = splitOf(kept, element.id);
    if ((split?.upper.length ?? 0) > 1) {
      expect(after?.upper).not.toContain(firstUpper);
    } else {
      expect(after).toBeUndefined();
    }
  });

  it('lets a shape follow only the texts that stay, and none once they are all gone', () => {
    const {screen, element} = screenWith(
      entry =>
        entry.kind === 'shape' && (entry.around ?? entry.beside) !== undefined,
    );
    if (element.kind !== 'shape') throw new Error('No shape');
    const followed = (element.around ?? element.beside)?.texts ?? [];
    const after = removeElements(screen, new Set(followed)).elements.find(
      entry => entry.id === element.id,
    );
    expect(after?.kind).toBe('shape');
    if (after?.kind === 'shape') {
      expect(after.around).toBeUndefined();
      expect(after.beside).toBeUndefined();
    }
  });

  it('frees the next text from the text it was sized by', () => {
    const {screen, element} = screenWith(
      entry => entry.kind === 'next' && entry.of !== undefined,
    );
    if (element.kind !== 'next' || element.of === undefined) {
      throw new Error('No next text');
    }
    const after = removeElements(screen, new Set([element.of])).elements.find(
      entry => entry.id === element.id,
    );
    expect(after?.kind === 'next' ? after.of : 'kept').toBeUndefined();
  });

  it('changes nothing when nothing is removed', () => {
    const [screen] = SCREENS;
    if (screen === undefined) throw new Error('No screen');
    expect(removeElements(screen, new Set())).toBe(screen);
  });
});

describe('restackElements', () => {
  it('moves chosen elements one step forward or backward past the others', () => {
    const screen = SCREENS.find(entry => entry.elements.length >= 3);
    if (screen === undefined) throw new Error('No screen of three');
    const [first, second] = ids(screen);
    if (first === undefined || second === undefined) throw new Error('No ids');
    const forward = restackElements(screen, new Set([first]), 'forward');
    expect(ids(forward).slice(0, 2)).toEqual([second, first]);
    const backward = restackElements(forward, new Set([first]), 'backward');
    expect(ids(backward)).toEqual(ids(screen));
  });
});

describe('newElement and pasting', () => {
  it('makes a picture only from a media file, and centres a new element on the point', () => {
    expect(newElement('picture')).toBeUndefined();
    const picture = newElement('picture', {
      media: createMediaId('00000000-0000-4000-8000-000000000601'),
    });
    expect(picture?.kind).toBe('picture');
    const text = newElement('text', {point: {x: 0, y: 0}});
    expect(text?.frame).toMatchObject({x: 0, y: 0});
  });

  it('reads no elements from text that is not theme elements or is too long', () => {
    expect(parseElements('not json')).toBeNull();
    expect(
      parseElements(JSON.stringify({format: 'other', elements: []})),
    ).toBeNull();
    expect(parseElements('x'.repeat(1_000_001))).toBeNull();
  });

  it('pastes no second background or next text, and nothing past the element limit', () => {
    const {screen, element} = screenWith(entry => entry.kind === 'background');
    expect(pasteElements(screen, [element])).toBeNull();
    const text = newElement('text');
    if (text === undefined) throw new Error('No text');
    const crowded: OwnThemeScreen = {
      ...screen,
      elements: Array.from({length: 40}, () => text),
    };
    expect(pasteElements(crowded, [text])).toBeNull();
  });
});
