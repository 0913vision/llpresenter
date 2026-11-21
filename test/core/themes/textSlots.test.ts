import {expect, it} from 'vitest';
import {createThemeId, createThemeElementId} from '@core/schema/ids';
import type {ThemeElement, ThemeScreenLayout} from '@core/schema/themes';
import {emptyLayers} from '@core/live/state';
import {isSlideEditableElement, themeElementText} from '@core/themes/content';
import {resolveThemeScreen} from '@core/themes/resolve';
import {themeTextBinding} from '@core/themes/textBindings';
import {isSlideEditableTextValue, matchSlideText} from '@core/themes/textSlots';
import {
  liveThemeTextElements,
  themeElementBase,
  themeScreens,
  THEME_MAIN,
  THEME_STAGE,
  THEME_CAPTURE,
} from '@fixtures/core/themeOutput';

const a = createThemeId('00000000-0000-4000-8000-000000005001');
const b = createThemeId('00000000-0000-4000-8000-000000005002');
const textBox = (
  slotId: string,
  index = 0,
  scope: 'screen' | 'shared' = 'shared',
) => ({
  ...themeElementBase(),
  id: createThemeElementId(
    `00000000-0000-4000-8000-${String(index + 5050).padStart(12, '0')}`,
  ),
  kind: 'text' as const,
  content: 'Fixed',
  textSlot: {
    slotId,
    role: 'reference' as const,
    name: 'Source reference',
    scope,
  },
});
const own = (elements: readonly ThemeElement[]): ThemeScreenLayout => ({
  mode: {kind: 'own'},
  elements,
});

it('uses an explicit binding before an ambiguous role, and keeps independent screen values', () => {
  const original = textBox('verse-reference');
  const origin = {
    themeId: a,
    sourceScreenId: THEME_MAIN,
    layout: own([original]),
  };
  const key = themeTextBinding(origin, original).key;
  const value = {
    mode: 'manual' as const,
    slotId: 'verse-reference',
    role: 'reference' as const,
    sourceThemeId: a,
    uniqueRole: true as const,
    text: '',
  };
  const text = {[key]: value};
  const other = textBox('independent', 1);
  const explicit = {
    themeId: b,
    sourceScreenId: THEME_MAIN,
    layout: own([other, original]),
  };
  expect(matchSlideText(text, explicit, original)?.value).toEqual(value);
  expect(matchSlideText(text, explicit, other)).toBeUndefined();
  const screenBox = textBox('verse-reference', 3, 'screen');
  expect(
    matchSlideText(text, {...explicit, layout: own([screenBox])}, screenBox),
  ).toBeUndefined();
});

it('maps only a unique compatible role across themes and returns the exact original on switch back', () => {
  const original = textBox('verse-reference');
  const changed = textBox('new-reference', 1);
  const origin = {
    themeId: a,
    sourceScreenId: THEME_MAIN,
    layout: own([original]),
  };
  const sameRole = {
    themeId: b,
    sourceScreenId: THEME_MAIN,
    layout: own([changed]),
  };
  const values = {
    [themeTextBinding(origin, original).key]: {
      mode: 'manual' as const,
      slotId: 'verse-reference',
      role: 'reference' as const,
      sourceThemeId: a,
      uniqueRole: true as const,
      text: 'Saved A',
    },
  };
  expect(matchSlideText(values, sameRole, changed)?.value).toMatchObject({
    text: 'Saved A',
  });
  const target = {
    id: b,
    name: 'Two references',
    screens: {
      [THEME_MAIN]: own([changed]),
      [THEME_STAGE]: own([textBox('other-stage')]),
      [THEME_CAPTURE]: {
        mode: {kind: 'same' as const, screen: THEME_MAIN},
        elements: [],
      },
    },
  };
  const linked = resolveThemeScreen(target, THEME_CAPTURE, themeScreens);
  expect(linked.sourceScreenId).toBe(THEME_MAIN);
  expect(
    matchSlideText(values, {...linked, themeId: b}, changed),
  ).toBeUndefined();
  expect(matchSlideText(values, origin, original)?.value).toMatchObject({
    text: 'Saved A',
  });
});

it('fills a named box from its declared role independently of its format', () => {
  expect(
    themeElementText(textBox('verse-reference'), {
      layers: {
        ...emptyLayers(),
        slide: {
          itemId: 'test',
          position: 0,
          label: null,
          lines: ['Verse'],
          reference: 'John 3:16',
        },
      },
      item: null,
    }),
  ).toBe('John 3:16');
});

it('keeps a reused layout element ID local when no portable role identifies it', () => {
  const {textSlot: _slot, ...implicit} = textBox('local');
  const duplicate = {...implicit, id: textBox('other', 2).id};
  const origin = {
    themeId: a,
    sourceScreenId: THEME_MAIN,
    layout: own([implicit]),
  };
  const target = {
    themeId: b,
    sourceScreenId: THEME_MAIN,
    layout: own([implicit, duplicate]),
  };
  const binding = themeTextBinding(origin, implicit);
  const values = {
    [binding.key]: {
      mode: 'manual' as const,
      slotId: binding.slotId,
      role: binding.role,
      sourceThemeId: a,
      screenId: THEME_MAIN,
      uniqueRole: true as const,
      text: 'Only this theme',
    },
  };
  expect(matchSlideText(values, origin, implicit)?.value).toMatchObject({
    text: 'Only this theme',
  });
  expect(matchSlideText(values, target, implicit)).toBeUndefined();
  expect(
    matchSlideText(values, {...target, layout: own([implicit])}, implicit)
      ?.value,
  ).toMatchObject({text: 'Only this theme'});
});

it.each(liveThemeTextElements())(
  'excludes $kind, its named aliases and its saved values',
  element => {
    const box = {
      ...textBox(element.kind),
      textSlot: {...textBox(element.kind).textSlot, role: element.kind},
    };
    const source = {
      themeId: a,
      sourceScreenId: THEME_MAIN,
      layout: own([element, box]),
    };
    const {key, slotId} = themeTextBinding(source, box);
    const saved = {
      mode: 'manual' as const,
      slotId,
      role: element.kind,
      sourceThemeId: a,
      text: 'Old value',
    };
    expect(isSlideEditableElement(element)).toBe(false);
    expect(isSlideEditableElement(box)).toBe(false);
    expect(isSlideEditableTextValue(element.kind, 'Old legacy value')).toBe(
      false,
    );
    expect(isSlideEditableTextValue(key, saved)).toBe(false);
    const legacyKey = [a, THEME_MAIN, element.id].join('/');
    expect(
      matchSlideText({[legacyKey]: 'Old legacy value'}, source, element),
    ).toBeUndefined();
    expect(matchSlideText({[key]: saved}, source, box)).toBeUndefined();

    const editable = textBox(slotId);
    const target = {
      themeId: b,
      sourceScreenId: THEME_MAIN,
      layout: own([editable]),
    };
    expect(isSlideEditableElement(editable)).toBe(true);
    expect(matchSlideText({[key]: saved}, target, editable)).toBeUndefined();
  },
);
