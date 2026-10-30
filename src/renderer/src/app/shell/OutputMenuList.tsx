import type {JSX} from 'react';
import {useSettingsDocument} from '@renderer/platform/useSettingsDocument';
import {useLive, useOutputs} from '@renderer/session/live';
import {Menu} from '@renderer/ui/Menu';
import type {Notice} from '@renderer/ui/notices';
import {useScreenSummaries} from '../../platform/ScreenSummaries';
import {outputMenuEntries} from './outputMenuEntries';
import type {WarningScreen} from './MenuBar';
import type {Workspace} from './Toolbar';

export function OutputMenuList({
  anchor,
  onClose,
  warnings,
  onShowWarning,
  onProblem,
  onWorkspace,
}: {
  readonly anchor: HTMLElement;
  readonly onClose: () => void;
  readonly warnings: readonly WarningScreen[];
  readonly onShowWarning: (id: string) => void;
  readonly onProblem: (notice: Notice) => void;
  readonly onWorkspace: ((workspace: Workspace) => void) | undefined;
}): JSX.Element {
  const screens = useScreenSummaries();
  const outputs = useOutputs();
  const lookId = useLive(view =>
    view.state === null ? undefined : (view.state.lookId ?? null),
  );
  const stageLayouts = useLive(view => view.state?.stageLayouts);
  const looks = useSettingsDocument('looks', 'Look', onProblem);
  const layouts = useSettingsDocument('stage-layouts', '무대 배치', onProblem);
  return (
    <Menu
      label="출력"
      anchor={{kind: 'element', element: anchor}}
      onClose={onClose}
      entries={outputMenuEntries({
        screens,
        outputs,
        looks: looks?.value ?? null,
        layouts: layouts?.value ?? null,
        lookId,
        stageLayouts,
        warnings,
        onShowWarning,
        onWorkspace,
        onProblem,
      })}
    />
  );
}
