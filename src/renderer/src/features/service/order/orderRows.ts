import type {ServiceRow} from '@core/presentation';

/** A 구역 and the items under it, or the items before the first 구역. */
export interface RowGroup {
  readonly id: string;
  readonly label: string | undefined;
  readonly items: readonly ServiceRow[];
}

/** The items among the chosen rows, without 구역. */
export function movableItems(
  rows: readonly ServiceRow[],
  ids: readonly string[],
): readonly string[] {
  const selected = new Set(ids);
  return rows
    .filter(row => row.kind !== 'header' && selected.has(row.id))
    .map(row => row.id);
}

/** Whether at least one chosen item can take a step in the direction. */
export function canMoveItems(
  rows: readonly ServiceRow[],
  ids: readonly string[],
  direction: 'up' | 'down',
): boolean {
  const chosen = new Set(movableItems(rows, ids));
  return rows.some((row, index) => {
    const neighbor = rows[index + (direction === 'up' ? -1 : 1)];
    return (
      chosen.has(row.id) && neighbor !== undefined && !chosen.has(neighbor.id)
    );
  });
}

/** The rows under their 구역. */
export function groupRows(rows: readonly ServiceRow[]): readonly RowGroup[] {
  const groups: Array<{
    id: string;
    label: string | undefined;
    items: ServiceRow[];
  }> = [];
  for (const row of rows) {
    if (row.kind === 'header') {
      groups.push({id: row.id, label: row.title, items: []});
      continue;
    }
    const last = groups.at(-1);
    if (last === undefined) {
      groups.push({id: row.id, label: undefined, items: [row]});
    } else {
      last.items.push(row);
    }
  }
  return groups;
}

/** Whether a row has a name of its own that the operator gives it. */
export function isNamed(row: ServiceRow): boolean {
  return row.kind === 'notice' || row.kind === 'blank' || row.kind === 'media';
}

/** The place of each item among all items, from 1. */
export function itemNumbers(
  rows: readonly ServiceRow[],
): ReadonlyMap<string, number> {
  return new Map(
    rows
      .filter(row => row.kind !== 'header')
      .map((row, index) => [row.id, index + 1] as const),
  );
}

/**
 * The rows a menu stands for: the chosen ones when the row is among them,
 * otherwise the row alone.
 */
export function rowsOfMenu(
  list: Element,
  id: string,
  selected: ReadonlySet<string>,
): readonly HTMLElement[] {
  return [...list.querySelectorAll<HTMLElement>('[data-order-id]')]
    .filter(row => {
      const rowId = row.dataset.orderId;
      return (
        rowId !== undefined &&
        (selected.has(id) ? selected.has(rowId) : rowId === id)
      );
    })
    .map(row => row.querySelector<HTMLElement>('[data-value]') ?? row);
}
