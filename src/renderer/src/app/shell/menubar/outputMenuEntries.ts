import {createScreenId} from '@core/schema/common/ids';
import {showTestPattern} from '@renderer/features/screens/preview/showTestPattern';
import {screenOutputSections} from '@renderer/features/screens/outputMenu/screenOutputSections';
import type {MenuEntry} from '@renderer/ui/menus/menuModel';
import {menuSeparator} from '@renderer/ui/menus/menuRows';
import type {ScreenSummary} from '@renderer/platform/screens/screenSummary';
import type {WarningScreen} from './MenuBar';

interface OutputMenuInput {
  readonly screens: readonly ScreenSummary[];
  readonly outputs: Readonly<Record<string, boolean>>;
  readonly hasItem: boolean;
  readonly warnings: readonly WarningScreen[];
  readonly onShowWarning: (id: string) => void;
}

/** Spec 11's grouped output commands and warnings. */
export function outputMenuEntries(
  input: OutputMenuInput,
): readonly MenuEntry[] {
  const {screens} = input;
  const sections = screenOutputSections(input);
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
