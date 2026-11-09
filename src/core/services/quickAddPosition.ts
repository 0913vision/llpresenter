import type {ServiceRow} from '../presentation/model';

/**
 * Inserts after the selected row, or at the end when no row is selected.
 */
export function quickAddBefore(
  rows: readonly ServiceRow[],
  selectedId: string | null,
): string | null {
  const selected = rows.findIndex(row => row.id === selectedId);
  if (selected < 0) return null;
  return rows[selected + 1]?.id ?? null;
}
