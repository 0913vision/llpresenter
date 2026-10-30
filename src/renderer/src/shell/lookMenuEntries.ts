import type {LookId} from '@shared/schema/ids';
import type {Look} from '@shared/schema/looks';
import type {MenuEntry} from '@renderer/ui/menuModel';
import {menuSeparator} from '@renderer/ui/menuRows';

export function lookMenuEntries({
  looks,
  current,
  choose,
  edit,
}: {
  readonly looks: readonly Look[];
  readonly current: LookId | null | undefined;
  readonly choose: (id: LookId) => void;
  readonly edit: () => void;
}): readonly MenuEntry[] {
  return [
    ...looks.map((look): MenuEntry => ({
      kind: 'item',
      id: look.id,
      label: look.name || '이름 없는 Look',
      check: 'radio',
      checked: look.id === current,
      onSelect: () => choose(look.id),
    })),
    ...(looks.length > 0 ? [menuSeparator('edit')] : []),
    {kind: 'item', id: 'edit', label: 'Look 편집…', onSelect: edit},
  ];
}
