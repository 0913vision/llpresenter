import {NOT_IN_THIS_WINDOW} from '@renderer/platform/problemReasons';
import type {ThemeId} from '@core/schema/ids';
import type {Theme, ThemesFile} from '@core/schema/themes';
import {isSectionTheme} from '@core/themes/sundaySections';
import {menuAvailability, type MenuEntry} from '@renderer/ui/menuModel';
import {menuSeparator} from '@renderer/ui/menuRows';

/** Resolves the confirmed theme name, including standby and missing states. */
export function liveThemeName(
  file: ThemesFile | null | undefined,
  id: ThemeId | undefined,
): string {
  const theme =
    file?.standby.id === id
      ? file?.standby
      : file?.themes.find(entry => entry.id === id);
  const deleted = file?.deletedThemes?.find(entry => entry.id === id);
  if (deleted !== undefined) return `(${deleted.name})`;
  return theme ? theme.name || '이름 없는 테마' : '없음';
}

/** Lists saved theme radios followed by the available editor action. */
export function themeMenuEntries({
  themes,
  current,
  deletedThemes = [],
  choose,
  edit,
  sectionCard = false,
}: {
  readonly themes: readonly Theme[];
  readonly current: ThemeId | null | undefined;
  readonly deletedThemes?: readonly Theme[];
  readonly choose: (id: ThemeId) => void;
  readonly edit: (() => void) | undefined;
  readonly sectionCard?: boolean | undefined;
}): readonly MenuEntry[] {
  return [
    ...deletedThemes
      .filter(theme => theme.id === current)
      .map((theme): MenuEntry => ({
        kind: 'item',
        id: theme.id,
        label: `(${theme.name})`,
        check: 'radio',
        checked: true,
        disabled: true,
        title: '삭제된 테마',
      })),
    ...themes
      .filter(theme => sectionCard || !isSectionTheme(theme.id))
      .map((theme): MenuEntry => ({
        kind: 'item',
        id: theme.id,
        command: `theme.${theme.id}`,
        label: theme.name || '이름 없는 테마',
        check: 'radio',
        checked: theme.id === current,
        onSelect: () => choose(theme.id),
      })),
    menuSeparator('edit'),
    {
      kind: 'item',
      id: 'edit',
      command: 'workspace.themes',
      label: '테마 편집',
      ...menuAvailability(edit === undefined ? NOT_IN_THIS_WINDOW : undefined),
      onSelect: edit,
    },
  ];
}
