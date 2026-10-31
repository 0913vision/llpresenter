import {menuAvailability} from '@renderer/ui/menuModel';
import {DEFAULT_ARRANGEMENT_NAME} from '@core/schema/song';
import type {MenuEntry} from '@renderer/ui/menuModel';
import {laterRow, menuSeparator} from '@renderer/ui/menuRows';

export interface ArrangementChoices {
  readonly names: readonly string[];
  readonly selected: string | undefined;
  readonly createReason: string | undefined;
  readonly choose: (name: string | undefined) => void;
  readonly create: () => void;
  readonly edit: () => void;
}

export function arrangementMenuEntries(
  input: ArrangementChoices,
): readonly MenuEntry[] {
  const option = (name: string | undefined): MenuEntry => ({
    kind: 'item',
    id: name ?? 'default',
    label: name ?? DEFAULT_ARRANGEMENT_NAME,
    check: 'radio',
    checked: input.selected === name,
    onSelect: () => input.choose(name),
  });
  return [
    option(undefined),
    menuSeparator('default-separator'),
    ...input.names.map(option),
    ...(input.names.length === 0 ? [] : [menuSeparator('actions')]),
    {
      kind: 'item',
      id: 'new',
      label: '새 구성…',
      ...menuAvailability(input.createReason),
      onSelect: input.create,
    },
    {kind: 'item', id: 'edit', label: '구성 편집…', onSelect: input.edit},
  ];
}

export function arrangementManagementEntries({
  reason,
  rename,
  remove,
}: {
  readonly reason: string | undefined;
  readonly rename: () => void;
  readonly remove: () => void;
}): readonly MenuEntry[] {
  return [
    laterRow('duplicate', '복제'),
    {
      kind: 'item',
      id: 'rename',
      label: '이름 바꾸기',
      ...menuAvailability(reason),
      onSelect: rename,
    },
    menuSeparator('delete-separator'),
    {
      kind: 'item',
      id: 'delete',
      label: '삭제',
      ...menuAvailability(reason),
      onSelect: remove,
    },
  ];
}
