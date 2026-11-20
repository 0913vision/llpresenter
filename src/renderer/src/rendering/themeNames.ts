import type {ThemeElementKind} from '@core/themes/elementRules';
import {themeTextRoleNames} from '@core/schema/themeTextSlot';

export const themeElementNames: Readonly<Record<ThemeElementKind, string>> = {
  ...themeTextRoleNames,
  media: '미디어',
  background: '배경',
  overlay: '오버레이',
  image: '이미지',
  box: '사각형',
};
