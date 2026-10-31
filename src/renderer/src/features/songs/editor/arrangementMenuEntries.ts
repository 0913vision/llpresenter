import {menuAvailability} from '@renderer/ui/menuModel';
import {DEFAULT_ARRANGEMENT_NAME} from '@core/schema/song';
import type {MenuEntry} from '@renderer/ui/menuModel';
import {menuSeparator} from '@renderer/ui/menuRows';

export interface ArrangementChoices {
  readonly names: readonly string[];
  readonly selected: string | undefined;
  readonly createReason: string | undefined;
  readonly choose: (name: string | undefined) => void;
  readonly create: () => void;
  readonly manageReason: string | undefined;
  readonly rename: () => void;
  readonly remove: () => void;
  readonly edit: () => void;
}

export const DEFAULT_ARRANGEMENT_REASON = '기본 구성은 바꿀 수 없습니다';

export function arrangementMenuEntries(
  input: ArrangementChoices,
): readonly MenuEntry[] {
  const manageReason =
    input.manageReason ??
    (input.selected === undefined ? DEFAULT_ARRANGEMENT_REASON : undefined);
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
    {
      kind: 'item',
      id: 'rename',
      label: '이름 바꾸기…',
      ...menuAvailability(manageReason),
      onSelect: input.rename,
    },
    {
      kind: 'item',
      id: 'delete',
      label: '지우기',
      ...menuAvailability(manageReason),
      onSelect: input.remove,
    },
    menuSeparator('edit-separator'),
    {kind: 'item', id: 'edit', label: '구성 편집…', onSelect: input.edit},
  ];
}
