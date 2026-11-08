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
    elements: layout.elements.map(element => {
      if (element.kind === 'reference') {
        const {source: _source, ...title} = element;
        return {...title, kind: 'itemName'};
      }
      return element.kind === 'currentText'
        ? {
            ...element,
            frame: {...element.frame, x: 129, w: 1676},
            text: {...element.text, maxLines: 4},
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
