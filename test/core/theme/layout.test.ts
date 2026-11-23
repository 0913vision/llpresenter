import {describe, expect, it} from 'vitest';
import type {OwnThemeScreen} from '@core/schema/theme';
import {BUILT_IN_THEME_IDS} from '@core/theme/builtIn/ids';
import {layoutTheme, type MeasuredText} from '@core/theme/layout';
import {builtIn} from '@fixtures/core/themeOutput';

function screenOf(
  purpose: keyof typeof BUILT_IN_THEME_IDS,
  kind: 'audience' | 'stage',
): OwnThemeScreen {
  const screen = builtIn(BUILT_IN_THEME_IDS[purpose]).screens[kind];
  if (screen.mode !== 'own') throw new Error('Not its own');
  return screen;
}

function textElements(screen: OwnThemeScreen) {
  return screen.elements.flatMap(element =>
    element.kind === 'text' || element.kind === 'next' ? [element] : [],
  );
}

/** A text of this many rows, each so many letters of one size wide. */
function rows(count: number, letters = 4): MeasuredText {
  return {
    at: size => ({
      height: Math.round(count * size * 1.3),
      width: letters * size,
    }),
  };
}

describe('layoutTheme', () => {
  it('keeps the size of a text that fits its frame', () => {
    const screen = screenOf('lyrics', 'audience');
    const [lyrics] = textElements(screen);
    if (lyrics === undefined) throw new Error('No text');
    const placed = layoutTheme(screen, new Map([[lyrics.id, rows(2)]]));
    expect(placed.texts.get(lyrics.id)?.size).toBe(
      lyrics.fit?.sizes?.[0] ?? lyrics.style.size,
    );
  });

  it('makes a text smaller until it fits', () => {
    const screen = screenOf('lyrics', 'audience');
    const [lyrics] = textElements(screen);
    if (lyrics === undefined) throw new Error('No text');
    const size = layoutTheme(
      screen,
      new Map([[lyrics.id, rows(2, 60)]]),
    ).texts.get(lyrics.id)?.size;
    expect(size).toBeLessThan(lyrics.style.size);
    expect(60 * (size ?? 0)).toBeLessThanOrEqual(lyrics.frame.w + 1);
  });

  it('stands the texts of a stack one under another', () => {
    const screen = screenOf('title', 'audience');
    const stack = screen.stacks?.[0];
    if (stack === undefined) throw new Error('No stack');
    const placed = layoutTheme(
      screen,
      new Map(stack.texts.map(id => [id, rows(1)])),
    );
    const [first, second] = stack.texts.map(id => placed.texts.get(id));
    if (first === undefined || second === undefined) throw new Error('No text');
    expect(second.y).toBeCloseTo(first.y + first.h + stack.gap);
  });

  it('centers a stack of one text where a stack of two is', () => {
    const screen = screenOf('title', 'audience');
    const stack = screen.stacks?.[0];
    if (stack?.anchor !== 'center') throw new Error('No stack');
    const [id] = stack.texts;
    if (id === undefined) throw new Error('No text');
    const text = layoutTheme(screen, new Map([[id, rows(1)]])).texts.get(id);
    expect((text?.y ?? 0) + (text?.h ?? 0) / 2).toBeCloseTo(stack.at);
  });

  it('never puts the next text over the text of the slide', () => {
    const screen = screenOf('lyrics', 'stage');
    const split = screen.splits?.[0];
    if (split === undefined) throw new Error('No split');
    for (const count of [1, 2, 4, 6, 8]) {
      const placed = layoutTheme(
        screen,
        new Map([
          ...split.upper.map(id => [id, rows(count)] as const),
          [split.lower, rows(count)],
        ]),
      );
      const lower = placed.texts.get(split.lower);
      for (const id of split.upper) {
        const upper = placed.texts.get(id);
        expect((upper?.y ?? 0) + (upper?.h ?? 0)).toBeLessThanOrEqual(
          (lower?.y ?? 0) + 1,
        );
      }
      expect((lower?.y ?? 0) + (lower?.h ?? 0)).toBeLessThanOrEqual(
        split.bottom + 1,
      );
    }
  });

  it('draws the slide text of 무대 at the size 청중 draws it', () => {
    const audience = screenOf('scripture', 'audience');
    const stage = screenOf('scripture', 'stage');
    const body = (screen: OwnThemeScreen) =>
      textElements(screen).find(element =>
        element.kind === 'text' ? element.content[0] === '{본문}' : false,
      );
    const there = body(audience);
    const here = body(stage);
    if (there === undefined || here === undefined) throw new Error('No body');
    const four = rows(4, 14);
    const sizeOn = (screen: OwnThemeScreen, id: string) =>
      layoutTheme(screen, new Map([[id, four]])).texts.get(id)?.size;
    expect(sizeOn(stage, here.id)).toBe(sizeOn(audience, there.id));
  });

  it('makes the next text smaller before the text of the slide', () => {
    const screen = screenOf('scripture', 'stage');
    const split = screen.splits?.[0];
    if (split === undefined) throw new Error('No split');
    const [address, body] = split.upper;
    if (address === undefined || body === undefined) throw new Error('No text');
    const alone = layoutTheme(screen, new Map([[body, rows(4, 14)]]));
    const placed = layoutTheme(
      screen,
      new Map([
        [address, rows(1)],
        [body, rows(4, 14)],
        [split.lower, rows(4, 14)],
      ]),
    );
    expect(placed.texts.get(body)?.size).toBe(alone.texts.get(body)?.size);
    const next = textElements(screen).find(({id}) => id === split.lower);
    expect(placed.texts.get(split.lower)?.size).toBeLessThan(
      next?.style.size ?? 0,
    );
  });
});
