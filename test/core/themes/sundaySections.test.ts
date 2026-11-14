import {parseThemes} from '@core/schema/themes';
import {expect, it} from 'vitest';
import {
  SUNDAY_SECTIONS,
  SECTION_THEMES,
  isSectionTheme,
  SECTION_THEME_ID,
  SECTION_RULES_ID,
  sectionGradient,
} from '@core/themes/sundaySections';
import {createDefaultThemes, legacySectionLayout} from '@core/themes/defaults';
import {resolveThemeScreen} from '@core/themes/resolve';
import {themeElementText} from '@core/themes/content';
import {emptyLayers} from '@core/live/state';
import {createScreenId} from '@core/schema/ids';
import {STARTER_SCREEN_IDS} from '@core/screens/screens';
import {resolveTextTracking} from '@core/themes/textTracking';
import {builtInTheme} from '@core/themes/defaults';
import {SECTION_BAND_ID, SECTION_NAME_ID} from '@core/themes/sectionBroadcast';

it('lists the section cards in service order with per-color gradient themes', () => {
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
  expect(new Set(SECTION_THEMES.map(picture => picture.id)).size).toBe(7);
  expect(SECTION_THEMES.every(theme => isSectionTheme(theme.id))).toBe(true);
  expect(isSectionTheme(undefined)).toBe(false);
  expect(isSectionTheme(createDefaultThemes().defaults.song)).toBe(false);
  for (const section of SUNDAY_SECTIONS) {
    expect(
      SECTION_THEMES.find(picture => picture.id === section.theme)?.color,
    ).toBe(section.color);
    expect(sectionGradient(section.color)).toMatchObject({
      angle: 135,
      mixing: 'oklch',
    });
  }
});

it('uses the matching gradient in every section theme without a media background', () => {
  const defaults = createDefaultThemes();
  for (const section of SECTION_THEMES) {
    const theme = defaults.themes.find(theme => theme.id === section.id);
    expect(
      theme?.screens[createScreenId(STARTER_SCREEN_IDS.main)]?.background,
    ).toEqual(sectionGradient(section.color));
  }
});

it('adds an editable section theme without changing the kind defaults or other screen layouts', () => {
  const defaults = createDefaultThemes();
  const theme = defaults.themes.find(theme => theme.id === SECTION_THEME_ID);
  expect(theme?.name).toBe('구역 이름 청록');
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
      id: SECTION_BAND_ID,
      kind: 'box',
      frame: {x: 0, y: 888, w: 1920, h: 102},
      box: {fill: '#000000', opacity: 88},
    },
    {
      id: SECTION_NAME_ID,
      kind: 'itemName',
      frame: {x: 230, y: 900, w: 1460, h: 90},
      text: {
        size: 64,
        weight: 700,
        align: 'center',
        color: '#FFFFFF',
        shadow: {on: true, opacity: 80, angle: 90, blur: 6, distance: 2},
      },
    },
  ]);
  expect(broadcast?.elements).toHaveLength(2);
  for (const section of SECTION_THEMES) {
    expect(
      defaults.themes.find(item => item.id === section.id)?.screens[
        createScreenId(STARTER_SCREEN_IDS.broadcast)
      ],
    ).toEqual(broadcast);
  }
  const stage = createScreenId(STARTER_SCREEN_IDS.stage);
  const stageLayout = theme?.screens[stage];
  const ordinaryStage = builtInTheme('song').screens[stage];
  for (const kind of ['nextText'] as const) {
    expect(
      stageLayout?.elements.find(element => element.kind === kind),
    ).toMatchObject(
      ordinaryStage?.elements.find(element => element.kind === kind) ?? {},
    );
  }
  expect(
    stageLayout?.elements.filter(
      element => element.kind === 'itemName' || element.kind === 'currentText',
    ),
  ).toMatchObject([{kind: 'itemName', text: {size: 170}}]);
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

it('shows both card lines on audience and only Korean on broadcast and stage for embedded and standalone cards', () => {
  const file = createDefaultThemes();
  const theme = file.themes.find(value => value.id === SECTION_THEME_ID);
  if (theme === undefined) throw Error('missing section theme');
  const screens = [
    {id: createScreenId(STARTER_SCREEN_IDS.main), kind: 'audience'},
    {id: createScreenId(STARTER_SCREEN_IDS.broadcast), kind: 'broadcast'},
    {id: createScreenId(STARTER_SCREEN_IDS.stage), kind: 'stage'},
  ] as const;
  for (const embedded of [false, true]) {
    const card = {
      name: SUNDAY_SECTIONS[1]?.name ?? '',
      english: "Apostle's Creed",
      theme: SECTION_THEME_ID,
    };
    const slide = {
      itemId: 'item',
      position: 0,
      label: null,
      lines: [card.english],
      ...(embedded ? {sectionCard: card} : {}),
    };
    const content = {
      layers: {...emptyLayers(), slide},
      item: {
        id: 'item',
        source: 'service' as const,
        kind: 'blank' as const,
        title: card.name,
      },
    };
    const audience = resolveThemeScreen(theme, screens[0].id, screens).layout;
    expect(
      audience.elements.map(element => themeElementText(element, content)),
    ).toContain(card.english);
    const broadcast = resolveThemeScreen(theme, screens[1].id, screens).layout;
    expect(
      broadcast.elements.map(element => themeElementText(element, content)),
    ).toEqual([null, card.name]);
    const stage = resolveThemeScreen(theme, screens[2].id, screens).layout;
    const title = stage.elements.find(element => element.kind === 'itemName');
    const english = stage.elements.find(
      element => element.kind === 'currentText',
    );
    expect(title && themeElementText(title, content)).toBe(card.name);
    expect(english).toBeUndefined();
  }
});

it('uses the new presentation for untouched saved defaults and preserves edited layouts', () => {
  const file = createDefaultThemes();
  const original = file.themes.find(theme => theme.id === SECTION_THEME_ID);
  if (original === undefined) throw Error('missing section theme');
  const screens = [
    {
      id: createScreenId(STARTER_SCREEN_IDS.broadcast),
      kind: 'broadcast',
      method: 'capture',
    },
    {
      id: createScreenId(STARTER_SCREEN_IDS.stage),
      kind: 'stage',
      method: 'fullscreen',
    },
  ] as const;
  const saved = {
    ...original,
    screens: Object.fromEntries(
      screens.map(screen => [screen.id, legacySectionLayout(screen)]),
    ),
  };
  const decoded = parseThemes(
    JSON.stringify({...file, themes: [saved]}),
    'themes.json',
  );
  if (!decoded.ok) throw Error(decoded.error.message);
  const reloaded = decoded.value.data.themes[0];
  if (reloaded === undefined) throw Error('missing saved theme');
  expect(
    resolveThemeScreen(reloaded, screens[0].id, screens).layout.elements[0]
      ?.kind,
  ).toBe('itemName');
  expect(
    resolveThemeScreen(saved, screens[0].id, screens).layout.elements[0]?.kind,
  ).toBe('itemName');
  expect(
    resolveThemeScreen(saved, screens[1].id, screens).layout.elements.some(
      element => element.kind === 'itemName',
    ),
  ).toBe(true);
  const editedLayout = {
    ...legacySectionLayout(screens[0]),
    background: '#123456',
  };
  const edited = {
    ...saved,
    screens: {...saved.screens, [screens[0].id]: editedLayout},
  };
  expect(resolveThemeScreen(edited, screens[0].id, screens).layout).toEqual(
    editedLayout,
  );
});
