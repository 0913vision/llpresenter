import {expect, it} from 'vitest';
import {
  SUNDAY_SECTIONS,
  SECTION_BACKGROUNDS,
  SECTION_THEME_ID,
  SECTION_RULES_ID,
  sectionGradient,
} from '@core/themes/sundaySections';
import {createDefaultThemes, builtInTheme} from '@core/themes/defaults';
import {createScreenId} from '@core/schema/ids';
import {STARTER_SCREEN_IDS} from '@core/screens/screens';
import {resolveTextTracking} from '@core/themes/textTracking';
import {STARTER_TEXT_STYLE} from '@core/themes/starterLayout';

it('lists the section cards in service order with per-color reusable pictures', () => {
  expect(
    SUNDAY_SECTIONS.map(section => [
      section.name,
      section.english,
      section.color,
    ]),
  ).toEqual([
    ['묵상기도', '', '청록'],
    ['사도신경', "Apostle's Creed", '청록'],
    ['회개와간구의기도', 'Repentance Prayer', '적갈'],
    ['찬양', 'Praise', '초록'],
    ['합심기도', 'Corporate Prayer', '적갈'],
    ['봉헌', 'Offering', '자주'],
    ['봉헌기도', 'Offering Prayer', '자주'],
    ['성찬식', 'Holy Communion', '청록초록'],
    ['축복기도', 'Blessing', '남보라'],
    ['세례식', 'Baptism', '청록초록'],
    ['간구기도', 'Supplication Prayer', '적갈'],
    ['광고', 'Notice', '남보라'],
    ['축도', 'Benediction', '올리브'],
  ]);
  expect(new Set(SECTION_BACKGROUNDS.map(picture => picture.id)).size).toBe(7);
  for (const section of SUNDAY_SECTIONS) {
    expect(
      SECTION_BACKGROUNDS.find(picture => picture.id === section.background)
        ?.color,
    ).toBe(section.color);
    expect(sectionGradient(section.color)).toMatchObject({
      angle: 135,
      mixing: 'oklch',
    });
  }
});

it('adds an editable section theme without changing the kind defaults or other screen layouts', () => {
  const defaults = createDefaultThemes();
  const theme = defaults.themes.find(theme => theme.id === SECTION_THEME_ID);
  expect(theme?.name).toBe('구역 이름');
  expect(Object.values(defaults.defaults)).not.toContain(SECTION_THEME_ID);
  const layout = theme?.screens[createScreenId(STARTER_SCREEN_IDS.main)];
  expect(layout?.background).toEqual(sectionGradient('청록'));
  expect(layout?.elements).toMatchObject([
    {kind: 'background'},
    {kind: 'media'},
    {kind: 'image', mediaId: SECTION_RULES_ID},
    {
      kind: 'itemName',
      frame: {x: 44, y: 412, w: 1876, h: 240},
      centerWhenTextEmpty: true,
      text: {
        font: 'KoPubWorldDotum',
        weight: 700,
        size: 152,
        tracking: 52,
        shortTracking: {
          maxCharacters: 2,
          tracking: 152,
          overrides: [
            {text: '회개와간구의기도', tracking: 40},
            {text: '봉헌', tracking: 52},
          ],
        },
        shadow: {on: false},
      },
    },
    {
      kind: 'currentText',
      frame: {x: 40, y: 613, w: 1880, h: 90},
      text: {
        font: 'KoPubWorldDotum',
        weight: 300,
        size: 56,
        tracking: 34,
        shadow: {on: false},
      },
    },
  ]);
  const broadcast =
    theme?.screens[createScreenId(STARTER_SCREEN_IDS.broadcast)];
  expect(broadcast?.elements).toMatchObject([
    {
      kind: 'currentText',
      text: {
        font: STARTER_TEXT_STYLE.font,
        size: STARTER_TEXT_STYLE.size,
        weight: STARTER_TEXT_STYLE.weight,
        vAlign: 'bottom',
      },
    },
  ]);
  for (const [axis, expected] of [
    ['x', 115.2],
    ['y', 64.8],
    ['w', 1689.6],
    ['h', 950.4],
  ] as const) {
    expect(broadcast?.elements[0]?.frame[axis]).toBeCloseTo(expected);
  }
  const stage = createScreenId(STARTER_SCREEN_IDS.stage);
  expect(theme?.screens[stage]).toEqual(builtInTheme('blank').screens[stage]);
});

it('widens short Unicode names, preserves their center, and leaves other text unchanged', () => {
  const style = {
    tracking: 52,
    shortTracking: {maxCharacters: 2, tracking: 152},
    align: 'center',
  } as const;
  expect(resolveTextTracking(style, '찬양')).toEqual({
    spacing: 152,
    indent: 100,
  });
  expect(resolveTextTracking(style, '합심기도')).toEqual({
    spacing: 52,
    indent: 0,
  });
  expect(resolveTextTracking(style, '𠮷복')).toEqual({
    spacing: 152,
    indent: 100,
  });
  expect(resolveTextTracking(style, '')).toEqual({spacing: 52, indent: 0});
  expect(resolveTextTracking(style, '찬 양')).toEqual({
    spacing: 152,
    indent: 100,
  });
  expect(resolveTextTracking(style, '찬\n양\n(계속)', true)).toEqual({
    spacing: 152,
    indent: 100,
  });
  expect(resolveTextTracking(style, '찬양 (계속)', true)).toEqual({
    spacing: 152,
    indent: 100,
  });
  expect(resolveTextTracking(style, '찬양 (계속)')).toEqual({
    spacing: 52,
    indent: 0,
  });
  expect(resolveTextTracking({align: 'center', tracking: 52}, '찬양')).toEqual({
    spacing: 52,
    indent: 0,
  });
});
