import * as v from 'valibot';
import {expect, it} from 'vitest';
import {
  STARTER_TEXT_STYLE,
  STARTER_STAGE_ELEMENTS,
} from '@core/themes/starterLayout';
import {STARTER_SCREEN_IDS} from '@core/screens/screens';
import {createScreenId} from '@core/schema/ids';
import {builtInTheme, createDefaultThemes} from '@core/themes/defaults';
import {resolveThemeOutput} from '@core/themes/output';
import {themeItemKinds} from '@core/themes/elementRules';
import {themesSchema} from '@core/schema/themes';

it('converts the starter audience styles and stage geometry into theme elements', () => {
  const main = createScreenId(STARTER_SCREEN_IDS.main);
  const broadcast = createScreenId(STARTER_SCREEN_IDS.broadcast);
  const stage = createScreenId(STARTER_SCREEN_IDS.stage);
  const theme = builtInTheme('song');
  expect(theme.screens[main]).toMatchObject({
    mode: {kind: 'own'},
    elements: [
      {kind: 'background'},
      {kind: 'media'},
      {
        kind: 'currentText',
        text: {
          font: STARTER_TEXT_STYLE.font,
          size: STARTER_TEXT_STYLE.size,
          vAlign: 'middle',
        },
      },
    ],
  });
  expect(theme.screens[broadcast]).toMatchObject({
    elements: [{kind: 'currentText', text: {vAlign: 'bottom'}}],
  });
  expect(theme.screens[broadcast]?.background).toBeUndefined();
  expect(theme.screens[stage]?.elements.map(element => element.frame)).toEqual(
    STARTER_STAGE_ELEMENTS.map(element => element.frame),
  );
  expect(theme.screens[stage]?.elements.map(element => element.kind)).toEqual([
    'label',
    'currentText',
    'clock',
    'timer',
    'nextLabel',
    'nextText',
    'stageMessage',
  ]);
});

it.each(themeItemKinds.filter(kind => kind !== 'ad'))(
  'keeps the default %s capture layout free of item backgrounds and inherits the empty color',
  kind => {
    const id = createScreenId(STARTER_SCREEN_IDS.broadcast);
    const screens = [
      {
        id,
        name: 'Capture',
        kind: 'broadcast',
        method: 'capture',
        emptyColor: '#123456',
      },
    ] as const;
    const output = resolveThemeOutput({
      file: createDefaultThemes(screens),
      screens,
      item: {id: 'invented', kind, source: 'external'},
      revision: 1,
    });
    expect(output.screens[id]?.emptyColor).toBe('#123456');
    expect(output.screens[id]?.layout.background).toBeUndefined();
    expect(
      output.screens[id]?.layout.elements.map(element => element.kind),
    ).toEqual(
      kind === 'bible' || kind === 'blank'
        ? ['currentText', 'reference']
        : ['currentText'],
    );
  },
);

it('adds a reference only for Bible layouts and adapts to configured screen IDs', () => {
  const id = createScreenId('00000000-0000-4000-8000-000000000999');
  const screens = [{id, kind: 'audience', method: 'fullscreen'}] as const;
  expect(Object.keys(builtInTheme('bible', screens).screens)).toEqual([id]);
  expect(
    builtInTheme('bible', screens).screens[id]?.elements.at(-1)?.kind,
  ).toBe('reference');
  expect(
    builtInTheme('song', screens).screens[id]?.elements.some(
      element => element.kind === 'reference',
    ),
  ).toBe(false);
});

it('reserves a separate bottom band for the capture Bible reference', () => {
  const id = createScreenId(STARTER_SCREEN_IDS.broadcast);
  const bible = builtInTheme('bible').screens[id];
  const verse = bible?.elements.find(element => element.kind === 'currentText');
  const reference = bible?.elements.find(
    element => element.kind === 'reference',
  );
  const song = builtInTheme('song').screens[id]?.elements.find(
    element => element.kind === 'currentText',
  );
  if (verse === undefined || reference === undefined || song === undefined) {
    throw new Error('Expected the starter capture text elements');
  }
  expect(verse.text.vAlign).toBe('bottom');
  expect(verse.frame.y + verse.frame.h).toBeLessThan(reference.frame.y);
  expect(reference.frame.y + reference.frame.h).toBeCloseTo(
    song.frame.y + song.frame.h,
  );
  expect(reference.frame.x).toBe(verse.frame.x);
  expect(reference.frame.w).toBe(verse.frame.w);
});

it('gives the 무대 화면 of the Bible 테마 no reference and the same element kinds as the song 테마', () => {
  const id = createScreenId(STARTER_SCREEN_IDS.stage);
  const kinds = (kind: 'bible' | 'song') =>
    (builtInTheme(kind).screens[id]?.elements ?? []).map(
      element => element.kind,
    );
  expect(kinds('bible')).not.toContain('reference');
  expect(kinds('bible')).toEqual(kinds('song'));
});

it('makes a valid file with built-in themes and a standby clock and timer on stage', () => {
  const defaults = createDefaultThemes();
  expect(v.safeParse(themesSchema, defaults).success).toBe(true);
  expect(defaults.themes.map(entry => entry.name)).toEqual([
    '찬양',
    '말씀',
    '영상',
    '광고',
  ]);
  const stage = createDefaultThemes().standby.screens;
  expect(
    Object.values(stage).map(layout => layout.elements.map(e => e.kind)),
  ).toEqual([['clock', 'timer']]);
});

it('defaults blank slides to 말씀 and builds the ad frame on every configured screen', () => {
  const file = createDefaultThemes();
  expect(file.defaults.blank).toBe(file.defaults.bible);
  const ad = file.themes.find(theme => theme.id === file.defaults.ad);
  expect(ad?.name).toBe('광고');
  for (const layout of Object.values(ad?.screens ?? {})) {
    expect(layout.elements.map(element => element.kind)).toEqual([
      'box',
      'box',
      'text',
      'media',
      'slideName',
      'currentText',
    ]);
    expect(layout.elements[0]).toMatchObject({
      frame: {x: 0, y: 0, w: 1920, h: 1080},
      box: {fill: '#141c2e'},
    });
    expect(layout.elements[1]).toMatchObject({
      frame: {w: 24},
      box: {fill: '#e6b54a'},
    });
    expect(layout.elements[2]).toMatchObject({
      content: '교회 소식',
      frame: {x: 150, y: 190},
    });
    expect(layout.elements[3]).toMatchObject({
      fit: 'fill',
      frame: {w: 1920, h: 1080},
    });
    expect(layout.elements[4]).toMatchObject({text: {size: 132, weight: 800}});
    expect(layout.elements[5]).toMatchObject({
      text: {size: 60, weight: 400, color: '#c9d1e0'},
    });
  }
  expect(builtInTheme('ad')).toEqual(ad);
  expect(builtInTheme('blank')).toEqual(builtInTheme('bible'));
});
