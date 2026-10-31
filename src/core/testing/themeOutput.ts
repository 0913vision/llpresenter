import {createScreenId, createThemeElementId} from '../schema/ids';
import type {Screen} from '../schema/screens';
import type {ThemeElement} from '../schema/themes';
import {STARTER_SCREEN_IDS} from '../screens/screens';
import {STARTER_LYRIC_STYLE} from '../looks/starterLayout';
import {createDefaultThemes} from '../themes/defaults';

export const THEME_MAIN = createScreenId(STARTER_SCREEN_IDS.main);
export const THEME_CAPTURE = createScreenId(STARTER_SCREEN_IDS.broadcast);
export const THEME_STAGE = createScreenId(STARTER_SCREEN_IDS.stage);
export const themeScreens: readonly Screen[] = [
  {
    id: THEME_MAIN,
    name: 'Audience',
    kind: 'audience',
    method: 'fullscreen',
    emptyColor: '#123456',
  },
  {id: THEME_CAPTURE, name: 'Capture', kind: 'audience', method: 'capture'},
  {id: THEME_STAGE, name: 'Stage', kind: 'stage', method: 'window'},
];

export function themeFile() {
  return createDefaultThemes(themeScreens);
}

export function fixedThemeText(
  content = 'Invented fixed text',
  index = 20,
): ThemeElement {
  return {
    id: createThemeElementId(
      `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    ),
    kind: 'text',
    frame: {x: 80, y: 80, w: 400, h: 200},
    text: STARTER_LYRIC_STYLE,
    content,
  };
}

export function themeElementBase(index = 30) {
  return {
    id: createThemeElementId(
      `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    ),
    frame: {x: 0, y: 0, w: 1920, h: 1080},
    text: {...STARTER_LYRIC_STYLE, maxLines: 12},
  };
}
