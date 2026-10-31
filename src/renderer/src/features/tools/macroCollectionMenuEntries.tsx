import {menuAvailability} from '@renderer/ui/menuModel';
import type {JSX} from 'react';
import {Menu, type MenuProps} from '@renderer/ui/Menu';
import type {MenuEntry} from '@renderer/ui/menuModel';
import {laterRow, menuSeparator} from '@renderer/ui/menuRows';

interface CollectionMenuActions {
  readonly reason: string | undefined;
  readonly rename: () => void;
  readonly remove: () => void;
}

export function macroCollectionMenuEntries(
  actions: CollectionMenuActions,
): readonly MenuEntry[] {
  return [
    laterRow('duplicate', '복제'),
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
  return <Menu {...props} entries={macroCollectionMenuEntries(actions)} />;
}
