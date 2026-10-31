import type {Label} from '@core/schema/labels';
import type {MenuEntry} from '@renderer/ui/menuModel';
import {menuSeparator} from '@renderer/ui/menuRows';

export function labelMenuEntries({
  labels,
  selected,
  choose,
  manage,
}: {
  readonly labels: readonly Label[];
  readonly selected: string | undefined;
  readonly choose: (name: string | undefined) => void;
  readonly manage: () => void;
}): readonly MenuEntry[] {
  return [
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
    {kind: 'item', id: 'manage', label: '이름표 관리…', onSelect: manage},
  ];
}
