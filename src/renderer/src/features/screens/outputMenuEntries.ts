import {NOT_IN_THIS_WINDOW} from '@renderer/platform/problemReasons';
import {windowCommandLabels} from '@renderer/ui/keys/windowCommandLabels';
import {shortcutText} from '@renderer/ui/keys/commandBindings';
import type {ThemeFile} from '@core/schema/theme';
import {
  outputGroup,
  itemStopEntry,
} from '@renderer/features/presentation/outputControlEntries';
import {menuAvailability, type MenuEntry} from '@renderer/ui/menus/menuModel';
import {menuSeparator} from '@renderer/ui/menus/menuRows';
import type {Notice} from '@renderer/ui/popups/notices';
import type {ScreenSummary} from '@renderer/platform/screens';
import {sendThemeChange} from './themeActions';
import {liveThemeName, themeMenuEntries} from './themeMenuEntries';

/** Screen/live/settings snapshots and an app-owned editor navigation callback. */
export interface ScreenOutputInput {
  readonly screens: readonly ScreenSummary[];
  readonly outputs: Readonly<Record<string, boolean>>;
  /** The themes a slide like the live one can be drawn with. */
  readonly themes: readonly ThemeFile[];
  readonly theme: ThemeFile | undefined;
  readonly hasItem: boolean;
  readonly onEditScreens: (() => void) | undefined;
  readonly onProblem: (notice: Notice) => void;
}

/** Ordered feature contributions; app warnings precede the settings section. */
export interface ScreenOutputSections {
  readonly audience: readonly MenuEntry[];
  readonly stage: readonly MenuEntry[];
  readonly broadcast: readonly MenuEntry[];
  readonly settings: readonly MenuEntry[];
}

/** Builds existing screen and theme choices without app navigation types. */
export function screenOutputSections(
  input: ScreenOutputInput,
): ScreenOutputSections {
  const {screens, outputs, onEditScreens} = input;
  const audience = screens.filter(
    screen => screen.kind !== 'stage' && screen.kind !== 'broadcast',
  );
  const stage = screens.filter(screen => screen.kind === 'stage');
  const broadcast = screens.filter(screen => screen.kind === 'broadcast');
  return {
    audience: [
      {kind: 'group', id: 'audience', label: '청중 화면'},
      {
        ...outputGroup(audience, outputs),
        id: 'audience-output',
        command: 'output.audience',
      },
      {
        kind: 'item',
        id: 'theme',
        label: `테마: ${liveThemeName(input.theme)}`,
        loadSubmenu: () =>
          themeMenuEntries({
            themes: input.themes,
            current: input.theme?.id,
            choose: themeId => sendThemeChange(themeId, input.onProblem),
            edit: onEditScreens,
          }),
      },
      itemStopEntry(input.hasItem),
    ],
    stage: [
      menuSeparator('stage'),
      {kind: 'group', id: 'stage-group', label: '무대 화면'},
      {
        ...outputGroup(stage, outputs),
        id: 'stage-output',
        command: 'output.stage',
      },
    ],
    broadcast: [
      menuSeparator('broadcast'),
      {kind: 'group', id: 'broadcast-group', label: '방송 화면'},
      {
        ...outputGroup(broadcast, outputs),
        id: 'broadcast-output',
        command: 'output.broadcast',
      },
    ],
    settings: [
      menuSeparator('screens'),
      {
        kind: 'item',
        id: 'screens',
        label: windowCommandLabels.screens,
        command: 'workspace.screens',
        meta: shortcutText('workspace.screens'),
        ...menuAvailability(
          window.llp === undefined ? NOT_IN_THIS_WINDOW : undefined,
        ),
        onSelect: () => window.llp?.window.openScreens(),
      },
    ],
  };
}
