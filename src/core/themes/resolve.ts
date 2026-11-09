import {sameJson} from '../common/sameJson';
import {isSectionTheme, sectionOtherLayout} from './sundaySections';
import type {ScreenId, ThemeId} from '../schema/ids';
import type {Screen} from '../schema/screens';
import type {Theme, ThemeScreenLayout, ThemesFile} from '../schema/themes';
import {builtInTheme, legacySectionLayout, type ThemeScreen} from './defaults';
import {themeElementProblem, type ThemeItemKind} from './elementRules';
import {SONG_THEME_ID} from './songTitle';

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

/**
 * The layout of a screen that has none saved in a theme: 청중 화면과 같음 for
 * a screen that is not the first of its kind, linked to that first screen, so a
 * screen added later shows what its group shows. The first screen of its kind
 * has no such default.
 */
export function implicitScreenLayout(
  screenId: ScreenId,
  screens: ReadonlyArray<Pick<Screen, 'id' | 'kind'>>,
): ThemeScreenLayout | undefined {
  const screen = screens.find(other => other.id === screenId);
  const first = screens.find(other => other.kind === screen?.kind);
  return first === undefined || first.id === screenId
    ? undefined
    : {mode: {kind: 'same', screen: first.id}, elements: []};
}

function resolvedSectionLayout(
  theme: Theme,
  layout: ThemeScreenLayout,
  source: Pick<Screen, 'id' | 'kind'> | undefined,
): ThemeScreenLayout {
  if (
    (source?.kind !== 'broadcast' && source?.kind !== 'stage') ||
    !isSectionTheme(theme.id)
  ) {
    return layout;
  }
  const legacy = legacySectionLayout({
    id: source.id,
    kind: source.kind,
    method: source.kind === 'broadcast' ? 'capture' : 'fullscreen',
  });
  return sameJson(layout, legacy)
    ? sectionOtherLayout(layout, source.kind)
    : layout;
}

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
    const saved = theme.screens[current];
    const implicit =
      saved === undefined ? implicitScreenLayout(current, screens) : undefined;
    const layout =
      implicit?.mode.kind === 'same' && visited.has(implicit.mode.screen)
        ? undefined
        : (saved ?? implicit);
    if (layout === undefined || layout.mode.kind === 'empty') {
      return {sourceScreenId: current, layout: emptyLayout};
    }
    if (layout.mode.kind === 'own') {
      const source = screens.find(screen => screen.id === current);
      let resolved = layout;
      if (
        source?.kind === 'audience' &&
        theme.id === SONG_THEME_ID &&
        layout.songTitle !== 'sunday'
      ) {
        resolved = {...layout, songTitle: 'sunday'};
      }
      resolved = resolvedSectionLayout(theme, resolved, source);
      return themeElementProblem(resolved.elements, destination.kind) ===
        undefined
        ? {sourceScreenId: current, layout: resolved}
        : empty;
    }
    current = layout.mode.screen;
  }
  return empty;
}
