import {useLive} from '@renderer/session/live';
import type {Notice} from '@renderer/ui/popups/notices';
import {useThemeSurfaces} from './ThemeCanvas';
import type {ThemeLeaveGuard} from './themeLeaveGuard';
import {ThemeProperties} from './ThemeProperties';
import {useThemeEditor} from './useThemeEditor';

export function useThemePanels(
  active: boolean,
  onProblem: ((notice: Notice) => void) | undefined,
  leaveGuard?: ThemeLeaveGuard,
) {
  const model = useThemeEditor(active, onProblem, leaveGuard);
  const liveId = useLive(view => view.state?.themeOutput?.theme.id);
  const surfaces = useThemeSurfaces(model, liveId);
  return {
    ...surfaces,
    ready:
      ((model.document !== null && model.list !== null) ||
        model.themesFailed ||
        window.llp === undefined) &&
      model.screensReady,
    right: <ThemeProperties model={model} />,
  };
}
