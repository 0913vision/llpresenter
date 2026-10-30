import type {Label} from '@shared/schema/labels';
import type {MenuEntry} from '@renderer/ui/menuModel';
import {laterRow, menuSeparator} from '@renderer/ui/menuRows';

export function labelMenuEntries({
  labels,
  selected,
  locked,
  choose,
  create,
  settings,
}: {
  readonly labels: readonly Label[];
  readonly selected: string | undefined;
  readonly locked: boolean;
  readonly choose: (name: string | undefined) => void;
  readonly create: () => void;
  readonly settings: () => void;
}): readonly MenuEntry[] {
  return [
    laterRow('edit', '편집…'),
    {
      kind: 'item',
      id: 'none',
      label: '이름표 없음',
      check: 'radio',
      checked: selected === undefined,
      onSelect: () => choose(undefined),
    },
    menuSeparator('labels'),
    ...labels.map(label => ({
      kind: 'item' as const,
      id: `label:${label.name}`,
      label: label.name,
      swatch: label.color,
      check: 'radio' as const,
      checked: selected === label.name,
      onSelect: () => choose(label.name),
    })),
    menuSeparator('actions'),
    {
      kind: 'item',
      id: 'new',
      label: '새 이름표',
      disabled: locked,
      onSelect: create,
    },
    {kind: 'item', id: 'settings', label: '이름표 설정…', onSelect: settings},
  ];
}

export function labelManagementEntries({
  disabledReason,
  color,
  rename,
  remove,
}: {
  readonly disabledReason: string | undefined;
  readonly color: () => void;
  readonly rename: () => void;
  readonly remove: () => void;
}): readonly MenuEntry[] {
  const locked = disabledReason !== undefined;
  return [
    {
      kind: 'item',
      id: 'color',
      label: '색 바꾸기',
      disabled: locked,
      title: disabledReason,
      onSelect: color,
    },
    menuSeparator('rename-separator'),
    {
      kind: 'item',
      id: 'rename',
      label: '이름 바꾸기',
      disabled: locked,
      title: disabledReason ?? '모든 곡에서 이 이름표의 이름을 바꿉니다',
      onSelect: rename,
    },
    menuSeparator('delete-separator'),
    {
      kind: 'item',
      id: 'delete',
      label: '삭제',
      disabled: locked,
      title:
        disabledReason ?? '공유 목록에서만 삭제하며 곡의 이름표는 유지합니다',
      onSelect: remove,
    },
  ];
}
