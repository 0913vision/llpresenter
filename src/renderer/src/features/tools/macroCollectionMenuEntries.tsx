import {menuAvailability} from '@renderer/ui/menuModel';
import type {JSX} from 'react';
import {Menu, type MenuProps} from '@renderer/ui/Menu';
import type {MenuEntry} from '@renderer/ui/menuModel';
import {menuSeparator} from '@renderer/ui/menuRows';

interface CollectionMenuActions {
  readonly reason: string | undefined;
  readonly duplicate: () => void;
  /** Why 복제 can't run apart from the lock reason, such as a full list. */
  readonly duplicateReason: string | undefined;
  readonly rename: () => void;
  readonly remove: () => void;
}

export function macroCollectionMenuEntries(
  actions: CollectionMenuActions,
): readonly MenuEntry[] {
  return [
    {
      kind: 'item',
      id: 'duplicate',
      contextGroup: 'clipboard',
      label: '복제',
      ...menuAvailability(actions.reason ?? actions.duplicateReason),
      onSelect: actions.duplicate,
    },
    {
      kind: 'item',
      id: 'rename',
      label: '이름 바꾸기',
      ...menuAvailability(actions.reason),
      onSelect: actions.rename,
    },
    menuSeparator('delete-separator'),
    {
      kind: 'item',
      id: 'delete',
      contextGroup: 'delete',
      label: '삭제',
      ...menuAvailability(actions.reason),
      onSelect: actions.remove,
    },
  ];
}

export function MacroCollectionMenu({
  actions,
  ...props
}: Omit<MenuProps, 'entries'> & {
  readonly actions: CollectionMenuActions;
}): JSX.Element {
  return (
    <Menu context {...props} entries={macroCollectionMenuEntries(actions)} />
  );
}
