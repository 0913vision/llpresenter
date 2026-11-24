import type {Screen} from '@core/schema/screens/screens';
import type {
  OwnThemeScreen,
  ScreenKind,
  ThemeFile,
  ThemeScreen,
} from '@core/schema/screens/theme';
import {themeScreenOf} from './themes';

type ScreenInfo = Pick<Screen, 'id' | 'kind'>;

/** Whether a screen is the one that the layout of its kind is for. */
export function isFirstOfKind(
  screen: ScreenInfo,
  screens: readonly ScreenInfo[],
): boolean {
  return screens.find(entry => entry.kind === screen.kind)?.id === screen.id;
}

/** What a theme says for a screen, before it follows another screen. */
export function ownScreenOf(
  theme: ThemeFile,
  screen: ScreenInfo,
  screens: readonly ScreenInfo[],
): ThemeScreen {
  if (isFirstOfKind(screen, screens)) return theme.screens[screen.kind];
  return theme.others?.[screen.id] ?? {mode: 'same', as: screen.kind};
}

/** Whether a screen can look like another kind of screen. */
export function canFollow(
  theme: ThemeFile,
  screen: ScreenInfo,
  {
    as,
    screens,
  }: {readonly as: ScreenKind; readonly screens: readonly ScreenInfo[]},
): boolean {
  if (!isFirstOfKind(screen, screens)) return true;
  if (screen.kind === as) return false;
  let next = theme.screens[as];
  const seen = new Set<ScreenKind>([as]);
  while (next.mode === 'same') {
    if (next.as === screen.kind || seen.has(next.as)) return false;
    seen.add(next.as);
    next = theme.screens[next.as];
  }
  return true;
}

/** A theme with another layout for a screen. */
export function withScreen(
  theme: ThemeFile,
  screen: ScreenInfo,
  {
    layout,
    screens,
  }: {
    readonly layout: ThemeScreen;
    readonly screens: readonly ScreenInfo[];
  },
): ThemeFile {
  if (isFirstOfKind(screen, screens)) {
    return {...theme, screens: {...theme.screens, [screen.kind]: layout}};
  }
  const {[screen.id]: _own, ...others} = theme.others ?? {};
  const {others: _others, ...rest} = theme;
  const next =
    layout.mode === 'same' && layout.as === screen.kind
      ? others
      : {...others, [screen.id]: layout};
  return Object.keys(next).length === 0 ? rest : {...rest, others: next};
}

const NOTHING: OwnThemeScreen = {mode: 'own', elements: []};

/** The layout a screen starts with when it stops following another one. */
export function ownLayoutFrom(
  theme: ThemeFile,
  screen: ScreenInfo,
): OwnThemeScreen {
  return themeScreenOf(theme, screen) ?? NOTHING;
}
