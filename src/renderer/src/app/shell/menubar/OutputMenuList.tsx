import {parseScreenId} from '@core/schema/common/ids';
import {useWindowShortcuts} from '@renderer/platform/shortcuts/windowShortcuts';
import {useMenuShortcuts} from '@renderer/ui/menus/useMenuShortcuts';
import {sendThemeChange} from '@renderer/features/screens/outputMenu/themeActions';
import {themesLike} from '@renderer/features/screens/outputMenu/themeMenuEntries';
import {sendLive, useLive, useOutputs} from '@renderer/session/live';
import type {JSX} from 'react';
import {useThemes} from '@renderer/platform/documents/themes';
import {Menu} from '@renderer/ui/menus/Menu';
import type {Notice} from '@renderer/ui/popups/notices';
import {useScreenSummaries} from '../../../platform/screens/ScreenSummaries';
import {outputMenuEntries} from './outputMenuEntries';
import type {WarningScreen} from './MenuBar';
import type {Workspace} from '../toolbar/Toolbar';

export function OutputMenuList({
  anchor,
  returnTo,
  onClose,
  warnings,
  onShowWarning,
  onProblem,
  onWorkspace,
}: {
  readonly anchor: HTMLElement | null;
  readonly returnTo?: HTMLElement | null | undefined;
  readonly onClose: () => void;
  readonly warnings: readonly WarningScreen[];
  readonly onShowWarning: (id: string) => void;
  readonly onProblem: (notice: Notice) => void;
  readonly onWorkspace: ((workspace: Workspace) => void) | undefined;
}): JSX.Element | null {
  const screens = useScreenSummaries();
  const outputs = useOutputs();
  const themes = useThemes(view => view.themes);
  const live = useLive(view => view.state?.themeOutput?.theme);
  const hasItem = useLive(
    view =>
      view.state?.item != null || (view.state?.testPatterns?.length ?? 0) > 0,
  );
  const offered = themesLike(themes, live);
  const entries = outputMenuEntries({
    screens,
    outputs,
    themes: offered,
    theme: live,
    hasItem,
    warnings,
    onShowWarning,
    onWorkspace,
    onProblem,
  });
  useMenuShortcuts(entries);
  useWindowShortcuts([
    {
      id: 'workspace.themes',
      when: () => onWorkspace !== undefined,
      run: () => onWorkspace?.('screens'),
    },
    ...offered.map(theme => ({
      id: `theme.${theme.id}`,
      run: () => sendThemeChange(theme.id, onProblem),
    })),
    ...screens.map(screen => ({
      id: `output.screen.${screen.id}`,
      run: () => {
        const id = parseScreenId(screen.id);
        if (id.ok) {
          sendLive({
            type: 'output.set',
            screenId: id.value,
            on: outputs[screen.id] !== true,
          });
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
