import {createThemeId} from '../schema/ids';
import type {Theme, ThemeScreenLayout} from '../schema/themes';
import type {ThemeScreen} from './defaults';

export const LIGHT_SONG_THEME_ID = createThemeId(
  '00000000-0000-4000-8000-000000000398',
);

export function lightSongTheme(
  song: Theme,
  screens: readonly ThemeScreen[],
): Theme {
  return {
    ...song,
    id: LIGHT_SONG_THEME_ID,
    name: '찬양 (밝은 배경)',
    screens: Object.fromEntries(
      screens.flatMap(screen => {
        const layout = song.screens[screen.id];
        if (layout === undefined) return [];
        const variant: ThemeScreenLayout =
          screen.kind === 'audience'
            ? {
                ...layout,
                songTitle: 'sunday-light',
                elements: layout.elements.map(element =>
                  element.kind === 'currentText'
                    ? {
                        ...element,
                        frame: {...element.frame, x: 36, w: 1848},
                        text: {...element.text, color: '#000000'},
                      }
                    : element,
                ),
              }
            : layout;
        return [[screen.id, variant]];
      }),
    ),
  };
}
