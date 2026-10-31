import * as v from 'valibot';
import {describe, expect, it} from 'vitest';
import {liveThemeItemSchema, liveThemeOutputSchema} from './liveTheme';
import {themeFile, themeScreens} from '../testing/themeOutput';
import {resolveThemeOutput} from '../themes/output';
import {parseLiveCommand} from './liveCommand';
import {createThemeId} from './ids';

describe('live theme payloads', () => {
  it('preserves the independently retained slide position', () => {
    const item = {
      id: 'song',
      kind: 'song',
      source: 'service',
      slidePosition: 0,
    };
    expect(v.safeParse(liveThemeItemSchema, item)).toMatchObject({
      success: true,
      output: item,
    });
  });
  it('accepts theme commands and rejects malformed theme IDs', () => {
    const command = {
      type: 'theme.set',
      themeId: createThemeId('00000000-0000-4000-8000-000000000111'),
    };
    expect(parseLiveCommand(command)).toEqual({ok: true, value: command});
    expect(parseLiveCommand({type: 'item.stop'}).ok).toBe(true);
    expect(parseLiveCommand({type: 'themes.refresh'}).ok).toBe(true);
    expect(parseLiveCommand({type: 'theme.set', themeId: 'missing'}).ok).toBe(
      false,
    );
    expect(parseLiveCommand({type: 'theme.set'}).ok).toBe(false);
  });
  it('accepts a resolved composition and rejects invalid nested layouts and colors', () => {
    const output = resolveThemeOutput({
      file: themeFile(),
      screens: themeScreens,
      item: null,
      revision: 1,
    });
    expect(v.safeParse(liveThemeOutputSchema, output).success).toBe(true);
    expect(
      v.safeParse(liveThemeOutputSchema, {...output, screens: {invalid: {}}})
        .success,
    ).toBe(false);
    const screen = themeScreens[0];
    if (screen === undefined) throw new Error('Missing screen');
    expect(
      v.safeParse(liveThemeOutputSchema, {
        ...output,
        screens: {
          [screen.id]: {...output?.screens[screen.id], emptyColor: 'green'},
        },
      }).success,
    ).toBe(false);
  });
  it('caps the compositions and diagnostic list', () => {
    const output = resolveThemeOutput({
      file: themeFile(),
      screens: themeScreens,
      item: null,
      revision: 1,
    });
    const screen = Object.values(output?.screens ?? {})[0];
    const many = Object.fromEntries(
      Array.from({length: 201}, (_, i) => [
        `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
        screen,
      ]),
    );
    expect(
      v.safeParse(liveThemeOutputSchema, {...output, screens: many}).success,
    ).toBe(false);
    expect(
      v.safeParse(liveThemeOutputSchema, {
        ...output,
        missing: ['one', 'two', 'three'],
      }).success,
    ).toBe(false);
  });
  it.each([
    {kind: 'unknown'},
    {title: 'x'.repeat(4001)},
    {memo: 1},
    {startedAt: Infinity},
    {source: 'renderer'},
    {slidePosition: -1},
    {slidePosition: 1.5},
    {slidePosition: Infinity},
  ])('rejects malformed item metadata %j', change => {
    expect(
      v.safeParse(liveThemeItemSchema, {
        id: 'item',
        kind: 'song',
        source: 'service',
        ...change,
      }).success,
    ).toBe(false);
  });
});
