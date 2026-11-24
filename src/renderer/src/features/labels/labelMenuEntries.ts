import type {Label} from '@core/schema/services/labels';
import type {MenuEntry} from '@renderer/ui/menus/menuModel';
import {menuSeparator} from '@renderer/ui/menus/menuRows';

/**
 * The menu for choosing an 이름표: 이름표 없음, one radio row per label with `selected`
 * checked, and rows to manage the labels or to take a free name when those
 * calls are given.
 */
export function labelMenuEntries({
  labels,
  selected,
  choose,
  manage,
  freeName,
}: {
  readonly labels: readonly Label[];
  readonly selected: string | undefined;
  readonly choose: (name: string | undefined) => void;
  readonly manage?: () => void;
  readonly freeName?: () => void;
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
    ...(freeName === undefined
      ? []
      : [
          menuSeparator('free-name-separator'),
          {
            kind: 'item' as const,
            id: 'free-name',
            label: '이름 적기…',
            onSelect: freeName,
          },
        ]),
    ...(manage === undefined
      ? []
      : [
          menuSeparator('actions'),
          {
            kind: 'item' as const,
            id: 'manage',
            label: '이름표 관리…',
            onSelect: manage,
          },
        ]),
  ];
}
