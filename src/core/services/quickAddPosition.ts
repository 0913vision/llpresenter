import type {ServiceRow} from '../presentation/model';

/**
 * Where quick add puts an item: before the header that ends the selected
 * item's group, or at the end (`null`) without a selection or a later header.
 */
export function quickAddBefore(
  rows: readonly ServiceRow[],
  selectedId: string | null,
): string | null {
  const selected = rows.findIndex(row => row.id === selectedId);
  if (selected < 0) return null;
  return (
    rows.find((row, index) => index > selected && row.kind === 'header')?.id ??
    null
  );
}
