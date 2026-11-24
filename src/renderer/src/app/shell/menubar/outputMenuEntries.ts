import {createScreenId} from '@core/schema/common/ids';
import {showTestPattern} from '@renderer/features/screens/preview/showTestPattern';
import type {ThemeFile} from '@core/schema/screens/theme';
import {screenOutputSections} from '@renderer/features/screens/outputMenu/outputMenuEntries';
import type {MenuEntry} from '@renderer/ui/menus/menuModel';
import {menuSeparator} from '@renderer/ui/menus/menuRows';
import type {Notice} from '@renderer/ui/popups/notices';
import type {ScreenSummary} from '../../../platform/screens/screens';
import type {WarningScreen} from './MenuBar';
import type {Workspace} from '../../../platform/WorkspaceNavigation';

interface OutputMenuInput {
  readonly screens: readonly ScreenSummary[];
  readonly outputs: Readonly<Record<string, boolean>>;
  readonly themes: readonly ThemeFile[];
  readonly theme: ThemeFile | undefined;
  readonly hasItem: boolean;
  readonly warnings: readonly WarningScreen[];
  readonly onShowWarning: (id: string) => void;
  readonly onWorkspace: ((workspace: Workspace) => void) | undefined;
  readonly onProblem: (notice: Notice) => void;
}

/** Spec 11's grouped output commands, theme choices, and warnings. */
export function outputMenuEntries(
  input: OutputMenuInput,
): readonly MenuEntry[] {
  const {screens, onWorkspace} = input;
  const sections = screenOutputSections({
    ...input,
    onEditScreens:
      onWorkspace === undefined ? undefined : () => onWorkspace('screens'),
  });
  const warningRows = input.warnings.map(
    ({screenId, screenName}): MenuEntry => {
      return {
        kind: 'item',
        id: `warning:${screenId}`,
        label: `${screens.find(screen => screen.id === screenId)?.statusLabel ?? screenName} 문제 보기`,
        onSelect: () => input.onShowWarning(screenId),
      };
    },
  );
  return [
    ...sections.audience,
    ...sections.stage,
    ...sections.broadcast,
    ...(warningRows.length > 0
      ? [menuSeparator('warnings'), ...warningRows]
      : []),
    menuSeparator('test-pattern'),
    {
      kind: 'item',
      id: 'test-patterns',
      label: '테스트 화면',
      submenu: screens.map(screen => ({
        kind: 'item' as const,
        id: `pattern:${screen.id}`,
        label: screen.statusLabel,
        onSelect: () => showTestPattern(createScreenId(screen.id)),
      })),
    },
    ...sections.settings,
  ];
}
