import type {JSX} from 'react';
import type {ThemeFile} from '@core/schema/screens/theme';
import {builtInTheme, isEditedTheme} from '@core/theme';
import {Menu, type MenuAnchor} from '@renderer/ui/menus/Menu';
import {menuAvailability, type MenuEntry} from '@renderer/ui/menus/menuModel';
import {themeProblems} from './themeNames';

/** What the theme menu does on its theme. */
export interface ThemeMenuActions {
  /** The theme is the default of its purpose. */
  readonly isDefault: boolean;
  /** Why the themes can't be changed now, if they can't. */
  readonly reason: string | undefined;
  /** Why no theme can be added now, if one can't. */
  readonly addReason: string | undefined;
  readonly makeDefault: () => void;
  readonly duplicate: () => void;
  readonly rename: () => void;
  readonly restore: () => void;
  readonly remove: () => void;
}

/**
 * The menu of a theme in the theme list: 기본으로 지정, 복제, 이름 바꾸기,
 * 처음으로 되돌리기 for an edited built-in theme, and 삭제 for an own one.
 */
export function themeMenuEntries(
  theme: ThemeFile,
  actions: ThemeMenuActions,
): readonly MenuEntry[] {
  const available = menuAvailability(actions.reason);
  return [
    {
      kind: 'item',
      id: 'default',
      label: '기본으로 지정',
      check: 'checkbox',
      checked: actions.isDefault,
      ...available,
      onSelect: actions.makeDefault,
    },
    {kind: 'separator', id: 'default-separator'},
    {
      kind: 'item',
      id: 'duplicate',
      contextGroup: 'clipboard',
      label: '복제',
      ...menuAvailability(actions.addReason),
      onSelect: actions.duplicate,
    },
    {
      kind: 'item',
      id: 'rename',
      label: '이름 바꾸기',
      ...available,
      onSelect: actions.rename,
    },
    ...(isEditedTheme(theme)
      ? ([
          {
            kind: 'item',
            id: 'restore',
            label: '처음으로 되돌리기',
            ...available,
            onSelect: actions.restore,
          },
        ] as const)
      : []),
    {kind: 'separator', id: 'delete-separator'},
    {
      kind: 'item',
      id: 'delete',
      contextGroup: 'delete',
      label: '삭제',
      ...menuAvailability(
        actions.reason ??
          (builtInTheme(theme.id) === undefined
            ? undefined
            : themeProblems.own),
      ),
      onSelect: actions.remove,
    },
  ];
}

/** The menu of a theme in the theme list, at `anchor`. */
export function ThemeMenu({
  theme,
  anchor,
  actions,
  onClose,
}: {
  readonly theme: ThemeFile;
  readonly anchor: MenuAnchor;
  readonly actions: ThemeMenuActions;
  readonly onClose: () => void;
}): JSX.Element {
  return (
    <Menu
      context
      label="테마"
      anchor={anchor}
      entries={themeMenuEntries(theme, actions)}
      onClose={onClose}
    />
  );
}
