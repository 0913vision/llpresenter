import type {JSX} from 'react';
import {DisplayLayout} from '@renderer/features/screens/DisplayLayout';
import {LookList, StageLayoutList} from '@renderer/features/screens/LookLists';
import {OutputPreview} from '@renderer/features/screens/OutputPreview';
import {ScreenList} from '@renderer/features/screens/ScreenList';
import {ScreenProperties} from '@renderer/features/screens/ScreenProperties';
import {LookEditor} from '@renderer/features/screens/looks/LookEditor';
import {useScreensSelection} from '@renderer/features/screens/selection';
import {StageCanvas} from '@renderer/features/screens/stage/StageCanvas';
import {StageProperties} from '@renderer/features/screens/stage/StageProperties';
import type {Notice} from '@renderer/ui/notices';
import type {PanelParts, WorkspacePanels} from '../shell/WorkspacePanel';

const LISTS = ['화면', 'Look', '무대 배치'] as const;
const SCREENS_COLUMNS = [LISTS, ['배치', '출력 미리보기'], ['속성']] as const;
const STAGE_COLUMNS = [LISTS, ['배치'], ['속성']] as const;
const LOOK_COLUMNS = [LISTS, ['Look 편집']] as const;

type ProblemHandler = ((notice: Notice) => void) | undefined;

function ScreenCanvas({onProblem}: {onProblem: ProblemHandler}): JSX.Element {
  const stage = useScreensSelection(view => view.selection.kind === 'stage');
  return stage ? (
    <StageCanvas onProblem={onProblem} />
  ) : (
    <DisplayLayout onProblem={onProblem} />
  );
}

function ScreenPropertiesOrStage({
  onProblem,
}: {
  onProblem: ProblemHandler;
}): JSX.Element {
  const stage = useScreensSelection(view => view.selection.kind === 'stage');
  return stage ? (
    <StageProperties onProblem={onProblem} />
  ) : (
    <ScreenProperties onProblem={onProblem} />
  );
}

function screensPanelParts(
  title: string,
  onProblem: ProblemHandler,
): PanelParts {
  switch (title) {
    case '화면':
      return {body: <ScreenList onProblem={onProblem} />};
    case 'Look':
      return {embedded: <LookList onProblem={onProblem} />};
    case 'Look 편집':
      return {embedded: <LookEditor onProblem={onProblem} />};
    case '무대 배치':
      return {embedded: <StageLayoutList onProblem={onProblem} />};
    case '배치':
      return {body: <ScreenCanvas onProblem={onProblem} />};
    case '속성':
      return {body: <ScreenPropertiesOrStage onProblem={onProblem} />};
    case '출력 미리보기':
      return {body: <OutputPreview onProblem={onProblem} />};
    default:
      return {};
  }
}

/** The panels of 화면 설정, with whether the Look editor takes the right side. */
export function useScreensPanels({
  active,
  onProblem,
}: {
  readonly active: boolean;
  readonly onProblem: ProblemHandler;
}): WorkspacePanels & {readonly lookEditing: boolean} {
  const lookEditing = useScreensSelection(
    view => active && view.selection.kind === 'look',
  );
  const stageEditing = useScreensSelection(
    view => view.selection.kind === 'stage',
  );
  const columns = lookEditing
    ? LOOK_COLUMNS
    : stageEditing
      ? STAGE_COLUMNS
      : SCREENS_COLUMNS;
  return {
    columns,
    partsOf: title => screensPanelParts(title, onProblem),
    lookEditing,
  };
}
