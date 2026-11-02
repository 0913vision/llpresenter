import {useLive} from '@renderer/session/live';
import type {Notice} from '@renderer/ui/notices';
import {useThemeEditor} from './useThemeEditor';
import {useThemeSurfaces} from './ThemeCanvas';
import {ThemeProperties} from './ThemeProperties';
import type {ThemeLeaveGuard} from './themeLeaveGuard';

export function useThemePanels(
  active: boolean,
  onProblem: ((notice: Notice) => void) | undefined,
  leaveGuard?: ThemeLeaveGuard,
) {
  const model = useThemeEditor(active, onProblem, leaveGuard);
  const live = useLive(view => view.state);
  const liveId =
    live?.themeOutput?.themeId ??
    (live !== null && live.layers.slide === null && live.layers.media === null
      ? model.file?.standby.id
      : undefined);
  const surfaces = useThemeSurfaces(model, liveId);
  return {...surfaces, right: <ThemeProperties model={model} />};
}
