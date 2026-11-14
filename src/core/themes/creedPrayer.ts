import {createThemeId} from '../schema/ids';
import type {Theme, ThemeScreenLayout} from '../schema/themes';
import type {ThemeScreen} from './defaults';
import {sundayScriptureLayout} from './sundayScripture';

export const CREED_PRAYER_THEME_ID = createThemeId(
  '00000000-0000-4000-8000-000000000371',
);

export function creedPrayerLayout(): ThemeScreenLayout {
  const layout = sundayScriptureLayout();
  return {
    ...layout,
    elements: layout.elements
      .filter(element => element.kind !== 'reference')
      .map(element => {
        return element.kind === 'currentText'
          ? {
              ...element,
              frame: {...element.frame, x: 129, y: 95, w: 1676},
              text: {
                ...element.text,
                maxLines: 4,
                align: 'left',
                lineHeight: 137 / 104,
              },
            }
          : element;
      }),
  };
}

export function creedPrayerTheme(
  scripture: Theme,
  screens: readonly ThemeScreen[],
): Theme {
  return {
    ...scripture,
    transition: {kind: 'wipe', sec: 0.5},
    id: CREED_PRAYER_THEME_ID,
    name: '사도신경, 주기도문',
    screens: {
      ...scripture.screens,
      ...Object.fromEntries(
        screens
          .filter(screen => screen.kind === 'audience')
          .map(screen => [screen.id, creedPrayerLayout()]),
      ),
    },
  };
}
