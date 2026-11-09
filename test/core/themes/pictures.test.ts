import {expect, it} from 'vitest';
import {createDefaultThemes} from '@core/themes/defaults';
import {THEME_BACKGROUNDS, THEME_DECORATIONS} from '@core/themes/pictures';
import {SUNDAY_STANDBY_PICTURE_IDS} from '@core/themes/sundayStandby';

it('resolves every Sunday theme image and the dark standby alternative without a media catalog', () => {
  const themes = createDefaultThemes();
  const pictures = [...THEME_BACKGROUNDS, ...THEME_DECORATIONS];
  const referenced = new Set(
    [themes.standby, ...themes.themes].flatMap(theme =>
      Object.values(theme.screens).flatMap(layout =>
        layout.elements.flatMap(element =>
          element.kind === 'image' ? [element.mediaId] : [],
        ),
      ),
    ),
  );
  expect(pictures).toHaveLength(9);
  expect(referenced.has(SUNDAY_STANDBY_PICTURE_IDS.serviceTimesBright)).toBe(
    true,
  );
  expect(referenced.has(SUNDAY_STANDBY_PICTURE_IDS.serviceTimes)).toBe(false);
  expect(new Set(pictures.map(picture => picture.id))).toEqual(
    new Set([...referenced, SUNDAY_STANDBY_PICTURE_IDS.serviceTimes]),
  );
  expect(THEME_BACKGROUNDS.map(picture => picture.name)).toEqual([
    '광고 배경',
    '말씀 배경',
    '설교 제목 배경',
    '설교 제목 두 줄 배경',
    '예배 안내 배경 (밝게)',
    '예배 안내 배경 (어둡게)',
    '예배 준비 배경',
  ]);
});
