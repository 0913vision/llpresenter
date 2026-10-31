import type {ThemeId} from '@core/schema/ids';
import type {Theme, ThemesFile} from '@core/schema/themes';
import {menuAvailability, type MenuEntry} from '@renderer/ui/menuModel';
import {menuSeparator} from '@renderer/ui/menuRows';

export function liveThemeName(
  file: ThemesFile | null | undefined,
  id: ThemeId | undefined,
): string {
  const theme =
    file?.standby.id === id
      ? file?.standby
      : file?.themes.find(entry => entry.id === id);
  return theme ? theme.name || '이름 없는 테마' : '없음';
}

export function themeMenuEntries({
  themes,
  current,
  choose,
  edit,
}: {
  readonly themes: readonly Theme[];
  readonly current: ThemeId | null | undefined;
  readonly choose: (id: ThemeId) => void;
  readonly edit: (() => void) | undefined;
}): readonly MenuEntry[] {
  return [
    ...themes.map((theme): MenuEntry => ({
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
      label: '테마 편집…',
      ...menuAvailability(
        edit === undefined ? '테마 편집 연결 안 됨' : undefined,
      ),
      onSelect: edit,
    },
  ];
}
