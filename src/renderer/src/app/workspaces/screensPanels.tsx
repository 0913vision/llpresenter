import {LookList, StageLayoutList} from '@renderer/features/screens/LookLists';
import {LookEditor} from '@renderer/features/screens/looks/LookEditor';
import {useScreensSelection} from '@renderer/features/screens/selection';
import {StageCanvas} from '@renderer/features/screens/stage/StageCanvas';
import {StageProperties} from '@renderer/features/screens/stage/StageProperties';
import type {Notice} from '@renderer/ui/notices';
import type {PanelParts, WorkspacePanels} from '../shell/WorkspacePanel';

const LISTS = ['Look', '무대 배치'] as const;
const STAGE_COLUMNS = [LISTS, ['배치'], ['속성']] as const;
const LOOK_COLUMNS = [LISTS, ['Look 편집']] as const;

type ProblemHandler = ((notice: Notice) => void) | undefined;

function themePanelParts(title: string, onProblem: ProblemHandler): PanelParts {
  switch (title) {
    case 'Look':
      return {embedded: <LookList onProblem={onProblem} />};
    case 'Look 편집':
      return {embedded: <LookEditor onProblem={onProblem} />};
    case '무대 배치':
      return {embedded: <StageLayoutList onProblem={onProblem} />};
    case '배치':
      return {body: <StageCanvas onProblem={onProblem} />};
    case '속성':
      return {body: <StageProperties onProblem={onProblem} />};
    default:
      return {};
  }
}

/** The temporary theme workspace, retaining the Look and stage editors. */
export function useScreensPanels({
  active,
  onProblem,
}: {
  readonly active: boolean;
  readonly onProblem: ProblemHandler;
}): WorkspacePanels & {readonly lookEditing: boolean} {
  const stageEditing = useScreensSelection(
    view => view.selection.kind === 'stage',
  );
  return {
    columns: stageEditing ? STAGE_COLUMNS : LOOK_COLUMNS,
    partsOf: title => themePanelParts(title, onProblem),
    lookEditing: active && !stageEditing,
  };
}
