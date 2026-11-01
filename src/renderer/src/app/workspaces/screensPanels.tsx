import {useThemePanels} from '@renderer/features/screens/themes/useThemePanels';
import type {Notice} from '@renderer/ui/notices';
import type {WorkspacePanels} from '../shell/WorkspacePanel';

const COLUMNS = [['테마'], ['테마 편집'], ['테마 속성']] as const;

/** Composes the theme list, shared canvas, and screen/element properties. */
export function useScreensPanels({
  active,
  onProblem,
}: {
  readonly active: boolean;
  readonly onProblem: ((notice: Notice) => void) | undefined;
}): WorkspacePanels {
  const panels = useThemePanels(active, onProblem);
  return {
    columns: COLUMNS,
    partsOf: title => ({
      embedded:
        title === '테마'
          ? panels.left
          : title === '테마 편집'
            ? panels.canvas
            : panels.right,
    }),
  };
}
