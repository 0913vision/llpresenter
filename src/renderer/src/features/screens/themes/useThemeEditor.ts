import {useState} from 'react';
import type {ScreenId, ThemeId} from '@core/schema/ids';
import {
  editThemeLayout,
  findTheme,
  themeLayout,
  type ThemeTarget,
} from '@core/themes/themeEdits';
import {resolveThemeScreen} from '@core/themes/resolve';
import type {Notice} from '@renderer/ui/notices';
import {useThemeResources} from './useThemeResources';
import {useThemeWrites} from './useThemeWrites';
import {useThemeSelection} from './useThemeSelection';
import {useThemeElements} from './useThemeElements';
export {themeCanvasBounds, type ThemeAddPlacement} from './useThemeElements';
/** One workspace session owns selection and all three panels' queued theme changes. */
export function useThemeEditor(
  active: boolean,
  onProblem: ((notice: Notice) => void) | undefined,
) {
  const resources = useThemeResources(active, onProblem);
  const writes = useThemeWrites(resources.document, onProblem);
  const {file, reason, apply} = writes;
  const {screens} = resources;

  const [themeId, setThemeId] = useState<ThemeId | null>(null);

  const [screenId, setScreenId] = useState<ScreenId | null>(null);

  const theme =
    file === null
      ? undefined
      : ((themeId === null ? undefined : findTheme(file, themeId)) ??
        file.themes[0] ??
        file.standby);

  const screen = screens.find(value => value.id === screenId) ?? screens[0];

  const target: ThemeTarget | undefined =
    theme === undefined || screen === undefined
      ? undefined
      : {theme: theme.id, screen, screens};

  const layout =
    target === undefined || file === null
      ? undefined
      : themeLayout(file, target);

  const visibleElements =
    theme === undefined || screen === undefined
      ? []
      : resolveThemeScreen(theme, screen.id, screens).layout.elements;

  const scope =
    theme === undefined || screen === undefined
      ? ''
      : `${theme.id}:${screen.id}`;

  const elementReason =
    reason ??
    (layout?.mode.kind !== 'own'
      ? '직접 배치에서만 변경할 수 있음'
      : undefined);
  const selection = useThemeSelection(scope, visibleElements);
  const actions = useThemeElements({target, elementReason}, writes, selection);
  const {select} = selection;
  return {
    ...resources,
    ...writes,
    ...selection,
    ...actions,
    theme,
    screen,
    target,
    layout,
    visibleElements,
    elementReason,
    chooseTheme: (id: ThemeId) => {
      setThemeId(id);
      select(null);
    },
    chooseScreen: (id: ScreenId) => {
      setScreenId(id);
      select(null);
    },
    layoutChange: (transform: Parameters<typeof editThemeLayout>[2]) => {
      if (target !== undefined) {
        apply(value => editThemeLayout(value, target, transform));
      }
    },
  };
}
export type ThemeModel = ReturnType<typeof useThemeEditor>;
