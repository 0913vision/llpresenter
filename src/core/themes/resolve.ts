import type {ScreenId, ThemeId} from '../schema/ids';
import type {Screen} from '../schema/screens';
import type {Theme, ThemeScreenLayout, ThemesFile} from '../schema/themes';
import {builtInTheme, type ThemeScreen} from './defaults';
import {themeElementProblem, type ThemeItemKind} from './elementRules';

interface ItemThemeRequest {
  readonly file: ThemesFile | null | undefined;
  readonly kind: ThemeItemKind;
  readonly source: 'service' | 'external';
  readonly theme?: ThemeId;
  readonly screens?: readonly ThemeScreen[];
}

export function resolveItemTheme(request: ItemThemeRequest): Theme {
  const {file, kind, source, theme, screens} = request;
  const own =
    source === 'service'
      ? file?.themes.find(entry => entry.id === theme)
      : undefined;
  const fallback = file?.themes.find(entry => entry.id === file.defaults[kind]);
  return own ?? fallback ?? builtInTheme(kind, screens);
}

const emptyLayout: ThemeScreenLayout = {mode: {kind: 'empty'}, elements: []};

export interface ResolvedThemeScreen {
  readonly sourceScreenId: ScreenId;
  readonly layout: ThemeScreenLayout;
}

/**
 * The source screen supplies the inherited empty color, including through links.
 * Broken links and cycles are empty. Stage-only content stays off audience screens.
 */
export function resolveThemeScreen(
  theme: Theme,
  screenId: ScreenId,
  screens: ReadonlyArray<Pick<Screen, 'id' | 'kind'>>,
): ResolvedThemeScreen {
  const empty = {sourceScreenId: screenId, layout: emptyLayout};
  const destination = screens.find(screen => screen.id === screenId);
  if (destination === undefined) return empty;
  const visited = new Set<ScreenId>();
  let current = screenId;
  while (!visited.has(current)) {
    visited.add(current);
    if (!screens.some(screen => screen.id === current)) return empty;
    const layout = theme.screens[current];
    if (layout === undefined || layout.mode.kind === 'empty') {
      return {sourceScreenId: current, layout: emptyLayout};
    }
    if (layout.mode.kind === 'own') {
      return themeElementProblem(layout.elements, destination.kind) ===
        undefined
        ? {sourceScreenId: current, layout}
        : empty;
    }
    current = layout.mode.screen;
  }
  return empty;
}
