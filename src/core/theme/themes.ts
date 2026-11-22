import type {ThemeId} from '../schema/ids';
import type {Slide} from '../schema/slide';
import type {Screen} from '../schema/screens';
import type {OwnThemeScreen, SlidePurpose, ThemeFile} from '../schema/theme';
import type {Themes} from '../schema/themes';
import {BUILT_IN_THEMES} from './builtIn';
import {BUILT_IN_THEME_IDS} from './builtIn/ids';
import {sameJson} from '../common/sameJson';

type ThemeList = Pick<Themes, 'themes' | 'defaults'>;

const builtIns = new Map(BUILT_IN_THEMES.map(theme => [theme.id, theme]));

/** The app's own form of a theme, or undefined for a theme the operator made. */
export function builtInTheme(id: ThemeId): ThemeFile | undefined {
  return builtIns.get(id);
}

/** Whether a theme of the app was changed by the operator. */
export function isEditedTheme(theme: ThemeFile): boolean {
  const own = builtIns.get(theme.id);
  return own !== undefined && !sameJson(own, theme);
}

/** A theme by its id. */
export function themeOf(
  list: ThemeList | null | undefined,
  id: ThemeId,
): ThemeFile | undefined {
  return list?.themes.find(theme => theme.id === id) ?? builtIns.get(id);
}

/** The theme a new slide of a purpose gets. */
export function themeFor(
  list: ThemeList | null | undefined,
  purpose: SlidePurpose,
): ThemeFile {
  const chosen = list?.defaults[purpose];
  const theme =
    (chosen === undefined ? undefined : themeOf(list, chosen)) ??
    themeOf(list, BUILT_IN_THEME_IDS[purpose]);
  if (theme === undefined) throw new Error(`No theme for ${purpose}`);
  return theme;
}

/** A slide whose theme may be gone. */
export type ThemedSlide = Pick<Slide, 'theme' | 'texts'>;

/**
 * The theme a slide is drawn with. When its own is gone, it is the first theme
 * of the app that has a box for each of its texts.
 */
export function themeOfSlide(
  list: ThemeList | null | undefined,
  {theme: id, texts}: ThemedSlide,
): ThemeFile {
  const own = themeOf(list, id);
  if (own !== undefined) return own;
  const names = Object.keys(texts);
  const fitting =
    names.length === 0
      ? undefined
      : BUILT_IN_THEMES.find(({boxes}) =>
          names.every(name => boxes.some(box => box.name === name)),
        );
  return themeFor(list, fitting?.purpose ?? 'blank');
}

/** What a screen draws of a theme; null when it shows nothing of it. */
export function themeScreenOf(
  theme: ThemeFile,
  screen: Pick<Screen, 'id' | 'kind'>,
): OwnThemeScreen | null {
  let layout = theme.others?.[screen.id] ?? theme.screens[screen.kind];
  const seen = new Set<string>([screen.kind]);
  while (layout.mode === 'same') {
    if (seen.has(layout.as)) return null;
    seen.add(layout.as);
    layout = theme.screens[layout.as];
  }
  return layout.mode === 'own' ? layout : null;
}
