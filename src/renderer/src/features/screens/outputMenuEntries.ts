import {shortcutText} from '@renderer/ui/commandBindings';
import type {ThemeId} from '@core/schema/ids';
import type {ThemesFile} from '@core/schema/themes';
import {outputStateKeys, STARTER_SCREEN_IDS} from '@core/screens/screens';
import {
  outputGroup,
  itemStopEntry,
} from '@renderer/features/presentation/outputControlEntries';
import {menuAvailability, type MenuEntry} from '@renderer/ui/menuModel';
import {laterRow, menuSeparator} from '@renderer/ui/menuRows';
import type {Notice} from '@renderer/ui/notices';
import type {ScreenSummary} from '@renderer/platform/screens';
import {sendThemeChange} from './themeActions';
import {liveThemeName, themeMenuEntries} from './themeMenuEntries';

/** Screen/live/settings snapshots and an app-owned editor navigation callback. */
export interface ScreenOutputInput {
  readonly screens: readonly ScreenSummary[];
  readonly outputs: Readonly<Record<string, boolean>>;
  readonly themes: ThemesFile | null;
  readonly themeId: ThemeId | undefined;
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
  const audience = screens.filter(screen => screen.kind !== 'stage');
  const stage = screens.filter(screen => screen.kind === 'stage');
  const captions = audience.filter(
    screen =>
      outputStateKeys(screen.id)[0] === STARTER_SCREEN_IDS.broadcast ||
      screen.targetKind === 'capture' ||
      screen.targetKind === 'ndi',
  );
  const capture = outputGroup(captions, outputs);
  return {
    audience: [
      {kind: 'group', id: 'audience', label: '본 화면'},
      {
        ...outputGroup(audience, outputs),
        id: 'audience-output',
        command: 'output.audience',
      },
      {
        kind: 'item',
        id: 'theme',
        label: `테마 바꾸기: ${liveThemeName(input.themes, input.themeId)}`,
        loadSubmenu: () =>
          themeMenuEntries({
            themes: input.themes?.themes ?? [],
            current: input.themeId,
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
      {kind: 'group', id: 'broadcast-group', label: '방송 자막'},
      {...capture, id: 'broadcast'},
      laterRow('broadcast-settings', '방송 설정…'),
    ],
    settings: [
      menuSeparator('screens'),
      {
        kind: 'item',
        id: 'screens',
        label: '화면 설정…',
        command: 'workspace.screens',
        meta: shortcutText('workspace.screens'),
        ...menuAvailability(
          window.llp === undefined ? '화면 설정 연결 안 됨' : undefined,
        ),
        onSelect: () => window.llp?.window.openScreens(),
      },
    ],
  };
}
