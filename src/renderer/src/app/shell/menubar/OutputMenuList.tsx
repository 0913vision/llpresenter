import {parseScreenId} from '@core/schema/common/ids';
import {useWindowShortcuts} from '@renderer/platform/shortcuts/windowShortcuts';
import {useMenuShortcuts} from '@renderer/ui/menus/useMenuShortcuts';
import {sendLive, useLive, useOutputs} from '@renderer/session/live';
import type {JSX} from 'react';
import {Menu} from '@renderer/ui/menus/Menu';
import {useScreenSummaries} from '@renderer/platform/screens/ScreenSummaries';
import {outputMenuEntries} from './outputMenuEntries';
import type {WarningScreen} from './MenuBar';
import type {Workspace} from '@renderer/platform/WorkspaceNavigation';

/** The 출력 menu, opened from the menu bar. */
export function OutputMenuList({
  anchor,
  returnTo,
  onClose,
  warnings,
  onShowWarning,
  onWorkspace,
}: {
  readonly anchor: HTMLElement | null;
  readonly returnTo?: HTMLElement | null | undefined;
  readonly onClose: () => void;
  readonly warnings: readonly WarningScreen[];
  readonly onShowWarning: (id: string) => void;
  readonly onWorkspace: ((workspace: Workspace) => void) | undefined;
}): JSX.Element | null {
  const screens = useScreenSummaries();
  const outputs = useOutputs();
  const hasItem = useLive(
    view =>
      view.state?.item != null || (view.state?.testPatterns?.length ?? 0) > 0,
  );
  const entries = outputMenuEntries({
    screens,
    outputs,
    hasItem,
    warnings,
    onShowWarning,
  });
  useMenuShortcuts(entries);
  useWindowShortcuts([
    {
      id: 'workspace.themes',
      when: () => onWorkspace !== undefined,
      run: () => onWorkspace?.('screens'),
    },
    ...screens.map(screen => ({
      id: `output.screen.${screen.id}`,
      run: () => {
        const id = parseScreenId(screen.id);
        if (id.ok) {
          sendLive({type: 'output.toggle', screenId: id.value});
        }
      },
    })),
  ]);
  return anchor === null ? null : (
    <Menu
      label="출력"
      anchor={{kind: 'element', element: anchor}}
      returnTo={returnTo}
      onClose={onClose}
      entries={entries}
    />
  );
}
