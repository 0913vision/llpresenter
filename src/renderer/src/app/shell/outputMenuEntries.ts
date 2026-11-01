import type {LookId, ThemeId} from '@core/schema/ids';
import type {LooksFile} from '@core/schema/looks';
import type {ThemesFile} from '@core/schema/themes';
import type {StageLayoutsFile} from '@core/schema/stageLayouts';
import type {LiveState} from '@core/live/state';
import {resolveOutputScreen} from '@core/screens/screens';
import {screenOutputSections} from '@renderer/features/screens/outputMenuEntries';
import type {MenuEntry} from '@renderer/ui/menuModel';
import {menuSeparator} from '@renderer/ui/menuRows';
import type {Notice} from '@renderer/ui/notices';
import type {ScreenSummary} from '../../platform/screens';
import type {Workspace} from './Toolbar';
import type {WarningScreen} from './MenuBar';

interface OutputMenuInput {
  readonly screens: readonly ScreenSummary[];
  readonly outputs: Readonly<Record<string, boolean>>;
  readonly looks: LooksFile | null;
  readonly themes: ThemesFile | null;
  readonly themeId: ThemeId | undefined;
  readonly hasItem: boolean;
  readonly layouts: StageLayoutsFile | null;
  readonly lookId: LookId | null | undefined;
  readonly stageLayouts: LiveState['stageLayouts'];
  readonly warnings: readonly WarningScreen[];
  readonly onShowWarning: (id: string) => void;
  readonly onWorkspace: ((workspace: Workspace) => void) | undefined;
  readonly onProblem: (notice: Notice) => void;
}

/** Spec 11's grouped output commands, theme/layout choices, and warnings. */
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
        label: `${resolveOutputScreen(screenId, screens)?.statusLabel ?? screenName} 경고 보기`,
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
    ...sections.settings,
  ];
}
