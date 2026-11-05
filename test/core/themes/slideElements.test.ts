import {expect, it} from 'vitest';
import {createDefaultThemes} from '@core/themes/defaults';
import {itemThemeKind} from '@core/themes/itemKind';
import {missingSlideElements} from '@core/themes/slideElements';
import {createScreenId} from '@core/schema/ids';
import {slidesItem} from '@fixtures/core/slides';

it('uses slide forms as theme kinds and warns only about content needing absent elements', () => {
  const screens = [
    {
      id: createScreenId('00000000-0000-4000-8000-000000000001'),
      name: 'Audience',
      kind: 'audience',
      method: 'fullscreen',
    },
  ] as const;
  const file = createDefaultThemes(screens);
  const ad = file.themes.find(theme => theme.id === file.defaults.ad);
  if (ad === undefined) throw Error('Missing ad theme');
  expect(itemThemeKind(slidesItem())).toBe('ad');
  expect(itemThemeKind(slidesItem('blank'))).toBe('blank');
  expect(missingSlideElements(slidesItem(), ad, screens)).toEqual([]);
  const theme = {
    ...ad,
    screens: {[screens[0].id]: {mode: {kind: 'own'}, elements: []}},
  } as const;
  expect(missingSlideElements(slidesItem(), theme, screens)[0]?.kinds).toEqual([
    'currentText',
    'slideName',
    'media',
  ]);
  expect(
    missingSlideElements(slidesItem('blank'), theme, screens)[0]?.kinds,
  ).toEqual(['currentText', 'media']);
});
