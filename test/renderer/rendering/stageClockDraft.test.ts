import {expect, it} from 'vitest';
import {createScreenId} from '@core/schema/ids';
import {STARTER_SCREEN_IDS} from '@core/screens/screens';
import {
  createDefaultThemes,
  IMAGE_SLIDES_THEME_ID,
} from '@core/themes/defaults';
import {stageClockDraft} from '@renderer/rendering/stageClockDraft';

it('leaves normal builds untouched and makes both stage clock drafts', () => {
  const id = createScreenId(STARTER_SCREEN_IDS.stage);
  const theme = createDefaultThemes().themes.find(
    item => item.id === IMAGE_SLIDES_THEME_ID,
  );
  const layout = theme?.screens[id];
  if (theme === undefined || layout === undefined) {
    throw Error('Missing image theme');
  }
  expect(stageClockDraft(layout, theme.id, undefined)).toBe(layout);
  const outlined = stageClockDraft(layout, theme.id, 'A');
  for (const kind of ['clock', 'timer']) {
    expect(
      outlined.elements.find(element => element.kind === kind),
    ).toMatchObject({
      text: {
        outline: {on: true, width: 3},
        shadow: {on: true, blur: 8, opacity: 60},
      },
    });
  }
  const strip = stageClockDraft(layout, theme.id, 'B');
  expect(
    strip.elements.find(element => element.kind === 'media'),
  ).toMatchObject({frame: {x: 0, y: 100, w: 1920, h: 980}, fit: 'fit'});
  expect(strip.elements.find(element => element.kind === 'box')).toMatchObject({
    frame: {x: 0, y: 0, w: 1920, h: 100},
    box: {fill: '#000000'},
  });
  expect(
    strip.elements.find(element => element.kind === 'clock')?.frame,
  ).toEqual(layout.elements.find(element => element.kind === 'clock')?.frame);
  const compact = stageClockDraft(layout, theme.id, 'B2');
  expect(
    compact.elements.find(element => element.kind === 'media'),
  ).toMatchObject({
    frame: {x: 0, y: 64, w: 1920, h: 1016},
    fit: 'fit',
  });
  expect(
    compact.elements.find(element => element.kind === 'box'),
  ).toMatchObject({
    frame: {x: 0, y: 0, w: 1920, h: 64},
  });
  expect(
    compact.elements.find(element => element.kind === 'clock'),
  ).toMatchObject({
    frame: {y: 4, h: 56},
    text: {size: 44},
  });
  expect(
    compact.elements.find(element => element.kind === 'timer'),
  ).toMatchObject({
    frame: {y: 4, h: 56},
    text: {size: 36},
  });
});
