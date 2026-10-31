import {describe, expect, it} from 'vitest';
import * as v from 'valibot';
import {STARTER_LYRIC_STYLE} from '../looks/starterLayout';
import {themeElementKinds} from '../themes/elementRules';
import {createDefaultThemes} from '../themes/defaults';
import {
  parseThemes,
  serializeThemes,
  themeElementSchema,
  themeFrameSchema,
  themeSchema,
  themeScreenLayoutSchema,
  themeTextSchema,
  themesSchema,
} from './themes';
import {expectSuccess} from './testHelpers';

const uuid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const text = {...STARTER_LYRIC_STYLE};
const frame = {x: 0, y: 0, w: 1920, h: 1080};
const element = {
  id: uuid(1),
  kind: 'text',
  frame,
  text,
  content: 'Example',
  mediaId: uuid(2),
  timerId: uuid(3),
  clockFormat: '24h',
  fit: 'fit',
  radius: 0,
  box: {on: true, fill: '#000000', opacity: 50, radius: 0},
};
const layout = {mode: {kind: 'own'}, elements: [element]};
const theme = {id: uuid(4), name: 'Example', screens: {[uuid(5)]: layout}};
const file = {
  format: 'llsettings.themes',
  schemaVersion: 1,
  standby: {...theme, id: uuid(6), screens: {}},
  themes: [theme],
  defaults: {},
};

describe('theme element properties', () => {
  it.each(themeElementKinds)('parses the %s element variant', kind => {
    expect(v.safeParse(themeElementSchema, {...element, kind}).success).toBe(
      true,
    );
  });

  it.each([
    {kind: 'other'},
    {frame: undefined},
    {text: undefined},
    {content: undefined},
    {kind: 'image', mediaId: undefined},
    {kind: 'clock', clockFormat: 'seconds'},
    {kind: 'timer', timerId: 'missing'},
    {kind: 'media', fit: 'cover'},
    {kind: 'background', fit: undefined},
    {kind: 'overlay', fit: undefined},
    {kind: 'box', box: undefined},
  ])('rejects invalid discriminant-specific properties %j', patch => {
    expect(
      v.safeParse(themeElementSchema, {...element, ...patch}).success,
    ).toBe(false);
  });

  it('allows an unassigned timer and both clock formats', () => {
    expect(
      v.safeParse(themeElementSchema, {
        ...element,
        kind: 'timer',
        timerId: undefined,
      }).success,
    ).toBe(false);
    const {timerId: _timerId, ...unassigned} = element;
    expect(
      v.safeParse(themeElementSchema, {...unassigned, kind: 'timer'}).success,
    ).toBe(true);
    expect(
      v.safeParse(themeElementSchema, {
        ...element,
        kind: 'clock',
        clockFormat: '12h',
      }).success,
    ).toBe(true);
  });

  it('accepts frames on the canvas boundaries and fractional reference pixels', () => {
    for (const value of [
      frame,
      {x: 1912, y: 1072, w: 8, h: 8},
      {x: 0.5, y: 1.5, w: 8.5, h: 9.5},
    ]) {
      expect(v.safeParse(themeFrameSchema, value).success).toBe(true);
    }
  });

  it.each([
    {x: -1},
    {y: -1},
    {w: 7.9},
    {h: 7.9},
    {w: 1921},
    {h: 1081},
    {x: 1},
    {y: 1},
    {x: Infinity},
    {w: NaN},
  ])('refuses undersized or off-canvas frames %j', patch => {
    expect(v.safeParse(themeFrameSchema, {...frame, ...patch}).success).toBe(
      false,
    );
  });

  it.each([
    {weight: 100, size: 12, lineHeight: 0.8, align: 'left', vAlign: 'top'},
    {weight: 900, size: 400, lineHeight: 3, align: 'right', vAlign: 'bottom'},
    {align: 'center', vAlign: 'middle'},
  ])('accepts text range endpoints %j', patch => {
    expect(v.safeParse(themeTextSchema, {...text, ...patch}).success).toBe(
      true,
    );
  });

  it.each([
    {font: ' '},
    {weight: 99},
    {weight: 901},
    {weight: 100.5},
    {size: 11.9},
    {size: 400.1},
    {lineHeight: 0.79},
    {lineHeight: 3.01},
    {align: 'justify'},
    {vAlign: 'baseline'},
    {color: '#FFF'},
  ])('rejects invalid text properties %j', patch => {
    expect(v.safeParse(themeTextSchema, {...text, ...patch}).success).toBe(
      false,
    );
  });

  it.each([1, 12, 0, 13, 1.5])('bounds lyric maxLines at %s', maxLines => {
    expect(
      v.safeParse(themeElementSchema, {
        ...element,
        kind: 'currentText',
        text: {...text, maxLines},
      }).success,
    ).toBe(maxLines === 1 || maxLines === 12);
  });

  it.each(['fit', 'fill', 'stretch'])('accepts media fit %s', fit => {
    expect(
      v.safeParse(themeElementSchema, {...element, kind: 'media', fit}).success,
    ).toBe(true);
  });

  it.each([0, 200, -1, 201])('bounds picture radius at %s', radius => {
    expect(
      v.safeParse(themeElementSchema, {...element, kind: 'image', radius})
        .success,
    ).toBe(radius >= 0 && radius <= 200);
    expect(
      v.safeParse(themeElementSchema, {
        ...element,
        kind: 'box',
        box: {...element.box, radius},
      }).success,
    ).toBe(radius >= 0 && radius <= 200);
  });

  it.each([0, 100, -1, 101])(
    'bounds text and rectangle fill opacity at %s',
    opacity => {
      for (const kind of ['text', 'box']) {
        expect(
          v.safeParse(themeElementSchema, {
            ...element,
            kind,
            box: {...element.box, opacity},
          }).success,
        ).toBe(opacity >= 0 && opacity <= 100);
      }
    },
  );

  it('rejects invalid fill colors and nonboolean checkboxes', () => {
    expect(
      v.safeParse(themeElementSchema, {
        ...element,
        box: {...element.box, fill: 'black'},
      }).success,
    ).toBe(false);
    expect(
      v.safeParse(themeElementSchema, {
        ...element,
        box: {...element.box, on: 1},
      }).success,
    ).toBe(false);
  });
});

describe('theme documents', () => {
  it.each([{kind: 'own'}, {kind: 'empty'}, {kind: 'same', screen: uuid(5)}])(
    'accepts screen mode %j',
    mode => {
      expect(
        v.safeParse(themeScreenLayoutSchema, {...layout, mode}).success,
      ).toBe(true);
    },
  );

  it.each([{kind: 'same'}, {kind: 'same', screen: 'main'}, {kind: 'copy'}, []])(
    'rejects invalid screen mode %j',
    mode => {
      expect(
        v.safeParse(themeScreenLayoutSchema, {...layout, mode}).success,
      ).toBe(false);
    },
  );

  it('validates an optional background override and unique element identities', () => {
    expect(
      v.safeParse(themeScreenLayoutSchema, {...layout, background: '#00B140'})
        .success,
    ).toBe(true);
    expect(
      v.safeParse(themeScreenLayoutSchema, {...layout, background: 'green'})
        .success,
    ).toBe(false);
    expect(
      v.safeParse(themeScreenLayoutSchema, {
        ...layout,
        elements: [element, element],
      }).success,
    ).toBe(false);
  });

  it('bounds theme names and accepts omitted screen entries', () => {
    expect(
      v.safeParse(themeSchema, {...theme, name: 'x'.repeat(80), screens: {}})
        .success,
    ).toBe(true);
    for (const name of ['', ' ', 'x'.repeat(81)]) {
      expect(v.safeParse(themeSchema, {...theme, name}).success).toBe(false);
    }
  });

  it('bounds screen maps and validates their keys and shape', () => {
    const screens = Object.fromEntries(
      Array.from({length: 200}, (_, n) => [uuid(n), layout]),
    );
    expect(v.safeParse(themeSchema, {...theme, screens}).success).toBe(true);
    for (const invalid of [
      {...screens, [uuid(201)]: layout},
      {main: layout},
      [],
    ]) {
      expect(
        v.safeParse(themeSchema, {...theme, screens: invalid}).success,
      ).toBe(false);
    }
  });

  it('bounds theme lists and requires unique identities including standby', () => {
    const themes = Array.from({length: 200}, (_, n) => ({
      ...theme,
      id: uuid(n + 100),
    }));
    expect(v.safeParse(themesSchema, {...file, themes}).success).toBe(true);
    for (const invalid of [
      [...themes, theme],
      [theme, theme],
      [file.standby],
    ]) {
      expect(
        v.safeParse(themesSchema, {...file, themes: invalid}).success,
      ).toBe(false);
    }
  });

  it('accepts missing default references for fallback but rejects malformed IDs', () => {
    expect(
      v.safeParse(themesSchema, {...file, defaults: {song: uuid(999)}}).success,
    ).toBe(true);
    expect(
      v.safeParse(themesSchema, {...file, defaults: {song: 'missing'}}).success,
    ).toBe(false);
  });

  it('restricts standby to fixed elements', () => {
    const standby = (kind: string) => ({
      ...file.standby,
      screens: {[uuid(5)]: {...layout, elements: [{...element, kind}]}},
    });
    expect(
      v.safeParse(themesSchema, {...file, standby: standby('text')}).success,
    ).toBe(true);
    expect(
      v.safeParse(themesSchema, {...file, standby: standby('currentText')})
        .success,
    ).toBe(false);
  });

  it('round-trips nested extensions and rejects wrong file headers', () => {
    const data = {
      ...file,
      themes: [
        {
          ...theme,
          future: {kept: true},
          screens: {
            [uuid(5)]: {
              ...layout,
              mode: {kind: 'own', future: 1},
              elements: [
                {
                  ...element,
                  future: 2,
                  frame: {...frame, future: 3},
                  text: {...text, shadow: {...text.shadow, future: 4}},
                },
              ],
            },
          },
        },
      ],
    };
    const parsed = expectSuccess(
      parseThemes(JSON.stringify(data), 'themes.json'),
    );
    const saved = expectSuccess(serializeThemes(parsed.data, 'themes.json'));
    expect(JSON.parse(saved)).toEqual(data);
    for (const patch of [
      {format: 'llsettings.looks'},
      {schemaVersion: 0},
      {standby: undefined},
      {defaults: undefined},
    ]) {
      expect(
        parseThemes(JSON.stringify({...file, ...patch}), 'themes.json').ok,
      ).toBe(false);
    }
  });

  it('parses the built-in layouts for all four kinds and an empty standby', () => {
    const defaults = createDefaultThemes();
    expect(v.safeParse(themesSchema, defaults).success).toBe(true);
    expect(defaults.themes.map(entry => entry.name)).toEqual([
      '찬양',
      '말씀',
      '광고',
      '영상',
    ]);
    expect(defaults.standby.screens).toEqual({});
  });
});
