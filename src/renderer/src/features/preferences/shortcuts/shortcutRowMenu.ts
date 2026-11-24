import {menuAvailability, type MenuEntry} from '@renderer/ui/menus/menuModel';
import type {ShortcutCommand} from '@core/shortcuts';
import type {ShortcutRow} from './shortcutsModel';

/** The menu row that puts a shortcut back to its default key. */
export const RESET_LABEL = '기본값으로';
/** The menu row that removes the key of a shortcut. */
export const CLEAR_LABEL = '지우기';
/** The name of the button that removes the key of a shortcut. */
export const CLEAR_BUTTON_LABEL = '단축키 지우기';

/** What the menu of a row in the 단축키 list does. */
export interface ShortcutRowActions {
  readonly edit: (id: string) => void;
  readonly reset: (id: string) => void;
  readonly clear: (command: ShortcutCommand) => void;
}

/** The menu of a row in the 단축키 list; all of it waits while `lockedReason` is set. */
export function shortcutRowMenuEntries(
  row: ShortcutRow,
  lockedReason: string | undefined,
  actions: ShortcutRowActions,
): readonly MenuEntry[] {
  return [
    {
      kind: 'item',
      id: 'edit',
      contextGroup: 'default',
      label: '단축키 편집',
      ...menuAvailability(lockedReason),
      onSelect: () => actions.edit(row.command.id),
    },
    {
      kind: 'item',
      id: 'reset',
      label: RESET_LABEL,
      ...menuAvailability(
        lockedReason ?? (row.changed ? undefined : '바꾼 키 없음'),
      ),
      onSelect: () => actions.reset(row.command.id),
    },
    {
      kind: 'item',
      id: 'clear',
      contextGroup: 'delete',
      label: CLEAR_LABEL,
      ...menuAvailability(
        lockedReason ??
          (row.bindings.length === 0 ? '지울 키 없음' : undefined),
      ),
      onSelect: () => actions.clear(row.command),
    },
  ];
}
