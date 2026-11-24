import {createScreenId, type ThemeId} from '@core/schema/common/ids';
import type {LiveThemeOutput} from '@core/schema/live/liveTheme';
import type {Screen} from '@core/schema/screens/screens';
import type {Themes} from '@core/schema/screens/themes';
import {STARTER_SCREEN_IDS} from '@core/screens/screens';
import {BUILT_IN_THEMES} from '@core/theme/builtIn';
import {BUILT_IN_THEME_IDS} from '@core/theme/builtIn/ids';
import {settingsDocument} from './settingsDocument';

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
  {id: THEME_CAPTURE, name: 'Capture', kind: 'broadcast', method: 'capture'},
  {id: THEME_STAGE, name: 'Stage', kind: 'stage', method: 'window'},
];

/** A theme of the app. */
export function builtIn(id: ThemeId) {
  const theme = BUILT_IN_THEMES.find(found => found.id === id);
  if (theme === undefined) throw new Error(`No theme ${id}`);
  return theme;
}

/** A theme of the app on output, with the empty colors of the screens. */
export function themeOutput(
  id: ThemeId = BUILT_IN_THEME_IDS.lyrics,
  more: Partial<LiveThemeOutput> = {},
): LiveThemeOutput {
  return {
    theme: builtIn(id),
    background: {kind: 'none'},
    revision: 1,
    missing: [],
    emptyColors: Object.fromEntries(
      themeScreens.map(screen => [screen.id, screen.emptyColor ?? '#000000']),
    ),
    ...more,
  };
}

/** The themes of the app, with no change of the operator. */
export function themes(): Themes {
  return {
    format: 'llsettings.themes',
    schemaVersion: 1,
    defaults: {},
    titles: [],
    themes: BUILT_IN_THEMES,
  };
}

export function themesDocument() {
  const document = settingsDocument('themes', themes());
  if (document.name !== 'themes') throw new Error('Invalid theme fixture');
  return document;
}
