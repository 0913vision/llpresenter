import {NOT_IN_THIS_WINDOW} from '@renderer/platform/problemReasons';
import type {ThemeId} from '@core/schema/common/ids';
import type {ThemeFile} from '@core/schema/screens/theme';
import type {Themes} from '@core/schema/screens/themes';
import {menuAvailability, type MenuEntry} from '@renderer/ui/menus/menuModel';
import {menuSeparator} from '@renderer/ui/menus/menuRows';

/** The name of the theme on output. */
export function liveThemeName(theme: ThemeFile | undefined): string {
  return theme?.name ?? '없음';
}

/** The themes a slide like the live one can be drawn with. */
export function themesLike(
  list: Themes | null,
  theme: ThemeFile | undefined,
): readonly ThemeFile[] {
  return (list?.themes ?? []).filter(
    entry => theme === undefined || entry.purpose === theme.purpose,
  );
}

/** Lists the themes that fit the live slide, and the theme editor. */
export function themeMenuEntries({
  themes,
  current,
  choose,
  edit,
}: {
  readonly themes: readonly ThemeFile[];
  readonly current: ThemeId | undefined;
  readonly choose: (id: ThemeId) => void;
  readonly edit: (() => void) | undefined;
}): readonly MenuEntry[] {
  return [
    ...themes.map((theme): MenuEntry => ({
      kind: 'item',
      id: theme.id,
      command: `theme.${theme.id}`,
      label: theme.name,
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
