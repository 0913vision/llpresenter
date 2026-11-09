import type {ServiceRow} from '../presentation/model';

/** Index after an item or at the end of a selected section. */
export function sectionInsertIndex<T extends {readonly id: string}>(
  rows: readonly T[],
  selectedId: string | null,
  isHeader: (row: T) => boolean,
): number {
  const selected = rows.findIndex(row => row.id === selectedId);
  if (selected < 0) return rows.length;
  const row = rows[selected];
  if (row !== undefined && isHeader(row)) {
    const next = rows.findIndex(
      (value, index) => index > selected && isHeader(value),
    );
    return next < 0 ? rows.length : next;
  }
  return selected + 1;
}

/**
 * Inserts at a selected section's end, after a selected item, or at the end.
 */
export function quickAddBefore(
  rows: readonly ServiceRow[],
  selectedId: string | null,
): string | null {
  return (
    rows[sectionInsertIndex(rows, selectedId, row => row.kind === 'header')]
      ?.id ?? null
  );
}
